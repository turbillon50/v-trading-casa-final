/**
 * Capa de datos de mercado (SERVIDOR). Precios de REFERENCIA públicos:
 *   - Coinbase Exchange (primario) — funciona desde infra US.
 *   - OKX (respaldo) — cuando Coinbase falla o el intervalo no existe allí.
 * Binance devuelve 451 desde US: NO se usa.
 *
 * HONESTIDAD: esto NO es la cuenta ni el motor. Son precios de referencia de
 * mercado. La fuente efectiva se devuelve en `source` para rotularla en la UI.
 * Nada se inventa: si ambas fuentes caen, se propaga el error y la UI muestra
 * estado offline.
 */

import type { Candle } from './indicators'
import { ema, rsi, last, pctChange } from './indicators'

export type Timeframe = '1m' | '5m' | '15m' | '1H' | '4H' | '1D' | '1W'
export type MarketSymbol = 'BTC' | 'ETH' | 'SOL'
export type MarketSource = 'COINBASE' | 'OKX'

export const SYMBOLS: MarketSymbol[] = ['BTC', 'ETH', 'SOL']
export const TIMEFRAMES: Timeframe[] = ['1m', '5m', '15m', '1H', '4H', '1D', '1W']

// Coinbase solo soporta 60/300/900/3600/21600/86400. 4H y 1W no existen allí:
// para esos vamos directo a OKX.
const COINBASE_GRAN: Record<Timeframe, number | null> = {
  '1m': 60,
  '5m': 300,
  '15m': 900,
  '1H': 3600,
  '4H': null,
  '1D': 86400,
  '1W': null,
}
const OKX_BAR: Record<Timeframe, string> = {
  '1m': '1m',
  '5m': '5m',
  '15m': '15m',
  '1H': '1H',
  '4H': '4H',
  '1D': '1D',
  '1W': '1W',
}

export interface CandleSeries {
  symbol: MarketSymbol
  timeframe: Timeframe
  source: MarketSource
  candles: Candle[]
  ts: number
}

// ── Cache en memoria ~30s para no golpear las APIs en cada render ───────────
const CACHE_TTL_MS = 30_000
const cache = new Map<string, CandleSeries>()

function nowMs(): number {
  return Date.now()
}

async function fetchCoinbase(symbol: MarketSymbol, tf: Timeframe): Promise<Candle[]> {
  const gran = COINBASE_GRAN[tf]
  if (gran == null) throw new Error('coinbase-no-granularity')
  const url = `https://api.exchange.coinbase.com/products/${symbol}-USD/candles?granularity=${gran}`
  const r = await fetch(url, {
    headers: { 'User-Agent': 'v-trading/2.0', Accept: 'application/json' },
    cache: 'no-store',
  })
  if (!r.ok) throw new Error(`coinbase ${r.status}`)
  const raw = (await r.json()) as number[][]
  // [time(s), low, high, open, close, volume] — más reciente primero
  const candles: Candle[] = raw
    .map((c) => ({ t: c[0] * 1000, l: c[1], h: c[2], o: c[3], c: c[4], v: c[5] }))
    .sort((a, b) => a.t - b.t)
  if (!candles.length) throw new Error('coinbase-empty')
  return candles
}

async function fetchOkx(symbol: MarketSymbol, tf: Timeframe): Promise<Candle[]> {
  const url = `https://www.okx.com/api/v5/market/candles?instId=${symbol}-USDT&bar=${OKX_BAR[tf]}&limit=300`
  const r = await fetch(url, { headers: { Accept: 'application/json' }, cache: 'no-store' })
  if (!r.ok) throw new Error(`okx ${r.status}`)
  const j = (await r.json()) as { code: string; data: string[][] }
  if (j.code !== '0' || !Array.isArray(j.data) || !j.data.length) throw new Error('okx-empty')
  // [ts(ms), o, h, l, c, vol, ...] — más reciente primero
  const candles: Candle[] = j.data
    .map((c) => ({
      t: Number(c[0]),
      o: Number(c[1]),
      h: Number(c[2]),
      l: Number(c[3]),
      c: Number(c[4]),
      v: Number(c[5]),
    }))
    .sort((a, b) => a.t - b.t)
  return candles
}

/**
 * Trae velas con failover. Para 4H/1W usa OKX de entrada (Coinbase no las
 * tiene). Para el resto: Coinbase → OKX.
 */
export async function getCandles(symbol: MarketSymbol, tf: Timeframe): Promise<CandleSeries> {
  const key = `${symbol}:${tf}`
  const cached = cache.get(key)
  if (cached && nowMs() - cached.ts < CACHE_TTL_MS) return cached

  let candles: Candle[] | null = null
  let source: MarketSource = 'COINBASE'

  if (COINBASE_GRAN[tf] != null) {
    try {
      candles = await fetchCoinbase(symbol, tf)
      source = 'COINBASE'
    } catch {
      candles = null
    }
  }
  if (!candles) {
    candles = await fetchOkx(symbol, tf) // si esto lanza, se propaga (offline honesto)
    source = 'OKX'
  }

  const series: CandleSeries = { symbol, timeframe: tf, source, candles, ts: nowMs() }
  cache.set(key, series)
  return series
}

export interface SymbolSnapshot {
  symbol: MarketSymbol
  source: MarketSource
  price: number
  change24hPct: number
  high24h: number
  low24h: number
  volume24h: number
  rsi14: number
  ema20: number
  ema50: number
  ema200: number
  trend: 'alcista' | 'bajista' | 'lateral'
}

/** Snapshot 1H de un símbolo para inyectar contexto a la agente. */
export async function getSnapshot(symbol: MarketSymbol): Promise<SymbolSnapshot> {
  const { candles, source } = await getCandles(symbol, '1H')
  const closes = candles.map((c) => c.c)
  const price = closes[closes.length - 1]
  // ventana ~24 velas 1H para el rango 24H
  const win = candles.slice(-24)
  const high24h = Math.max(...win.map((c) => c.h))
  const low24h = Math.min(...win.map((c) => c.l))
  const volume24h = win.reduce((s, c) => s + c.v, 0)
  const change24hPct = pctChange(win.map((c) => c.c))
  const rsi14 = last(rsi(closes, 14))
  const ema20 = last(ema(closes, 20))
  const ema50 = last(ema(closes, 50))
  const ema200 = last(ema(closes, 200))
  let trend: SymbolSnapshot['trend'] = 'lateral'
  if (!isNaN(ema20) && !isNaN(ema50)) {
    if (ema20 > ema50 && price > ema20) trend = 'alcista'
    else if (ema20 < ema50 && price < ema20) trend = 'bajista'
  }
  return {
    symbol,
    source,
    price,
    change24hPct,
    high24h,
    low24h,
    volume24h,
    rsi14,
    ema20,
    ema50,
    ema200,
    trend,
  }
}

/** Snapshots de los 3 pares principales; los que fallen se omiten. */
export async function getMarketSnapshots(): Promise<SymbolSnapshot[]> {
  const results = await Promise.allSettled(SYMBOLS.map((s) => getSnapshot(s)))
  return results
    .filter((r): r is PromiseFulfilledResult<SymbolSnapshot> => r.status === 'fulfilled')
    .map((r) => r.value)
}

function fmt(n: number, dp = 2): string {
  if (isNaN(n)) return 's/d'
  return n.toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp })
}

/** Bloque de texto legible para inyectar como contexto de mercado a la agente. */
export function snapshotsToContext(snaps: SymbolSnapshot[]): string {
  if (!snaps.length) return 'Contexto de mercado: no disponible en este momento (fuentes de referencia sin respuesta).'
  const src = snaps[0].source
  const lines = snaps.map((s) => {
    const dir = s.change24hPct >= 0 ? '+' : ''
    return `- ${s.symbol}/USD: $${fmt(s.price)} (${dir}${fmt(s.change24hPct)}% 24h) · RSI14 ${fmt(s.rsi14, 0)} · EMA20 ${fmt(s.ema20)} · EMA50 ${fmt(s.ema50)} · EMA200 ${fmt(s.ema200)} · tendencia ${s.trend} · máx24h ${fmt(s.high24h)} · mín24h ${fmt(s.low24h)}`
  })
  return `Contexto de mercado en vivo (precio de REFERENCIA · ${src}, NO es la cuenta ni el motor):\n${lines.join('\n')}`
}
