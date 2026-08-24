/**
 * lib/hetzner-feed.ts — cliente SERVIDOR del feed de Bybit en el Hetzner.
 *
 * Bybit responde 403 desde Vercel (US) y 200 desde el Hetzner (Alemania). Por eso
 * TODO lo de Bybit (velas perpetuas, markPrice, funding, OI, basis, cuenta
 * read-only y modo papel) pasa por un servicio en el servidor, expuesto por nginx
 * en un path autenticado. Esta capa solo corre en el servidor (runtime nodejs):
 * el token NUNCA llega al cliente.
 *
 *   HETZNER_FEED_URL   — p.ej. https://api.vforge.site/vtfeed  (sin slash final)
 *   HETZNER_FEED_TOKEN — cabecera secreta X-Feed-Token
 *
 * Si no está configurado o el servicio no responde, cada función lanza y el caller
 * cae a las fuentes de referencia (Coinbase/OKX). Nunca inventa datos.
 */

const FEED_URL = (process.env.HETZNER_FEED_URL || '').replace(/\/$/, '')
const FEED_TOKEN = process.env.HETZNER_FEED_TOKEN || ''
const TIMEOUT_MS = 6000

export function feedConfigured(): boolean {
  return !!FEED_URL && !!FEED_TOKEN
}

async function feedFetch<T>(path: string, init?: RequestInit): Promise<T> {
  if (!feedConfigured()) throw new Error('hetzner-feed-no-configurado')
  const res = await fetch(`${FEED_URL}${path}`, {
    ...init,
    headers: { 'X-Feed-Token': FEED_TOKEN, 'Content-Type': 'application/json', ...(init?.headers || {}) },
    cache: 'no-store',
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!res.ok) throw new Error(`hetzner-feed ${res.status}`)
  const j = (await res.json()) as { ok?: boolean } & T
  if (j && (j as { ok?: boolean }).ok === false) throw new Error('hetzner-feed-not-ok')
  return j as T
}

// ── Tipos ────────────────────────────────────────────────────────────────────
export interface PerpCandle { t: number; o: number; h: number; l: number; c: number; v: number }

export interface PerpTicker {
  symbol: string
  lastPrice: number
  markPrice: number
  indexPrice: number
  fundingRate: number
  fundingAnnualPct: number
  nextFundingTime: number
  openInterest: number
  openInterestValue: number
  volume24h: number
  turnover24h: number
  basis: number
  basisPct: number
  price24hPcnt: number
  source: 'BYBIT'
}

export interface PaperTrade {
  id: number
  symbol: string
  side: 'long' | 'short'
  size: number
  entry_price: number
  leverage: number
  stop_loss: number | null
  take_profit: number | null
  thesis: string
  funding_at_entry: number | null
  oi_at_entry: number | null
  basis_at_entry: number | null
  opened_at: string
  closed_at: string | null
  exit_price: number | null
  gross_pnl: number | null
  fee_estimada: number | null
  net_pnl: number | null
  outcome: 'open' | 'win' | 'loss' | 'breakeven'
  motivo_cierre: string | null
  last_mark_price: number | null
  unrealized_pnl: number | null
  agente_version: string
}

export interface PaperMetrics {
  cerradas: number
  abiertas: number
  wins: number
  losses: number
  win_rate: number
  net_total: number
  gross_total: number
  fees_total: number
  fee_bite_ratio: number | null
  expectativa_por_op: number
  avg_win: number
  avg_loss: number
  unrealized_abierto: number
}

// ── Endpoints ─────────────────────────────────────────────────────────────────
export function perpCandles(symbolUsdt: string, tf: string): Promise<{ candles: PerpCandle[]; source: 'BYBIT' }> {
  return feedFetch(`/perp/velas?symbol=${encodeURIComponent(symbolUsdt)}&tf=${encodeURIComponent(tf)}`)
}

export function perpTicker(symbolUsdt: string): Promise<PerpTicker> {
  return feedFetch(`/perp/ticker?symbol=${encodeURIComponent(symbolUsdt)}`)
}

export function accountEstado(): Promise<{ equity: number | null; available: number | null; openPositions: number; positions: unknown[] }> {
  return feedFetch(`/cuenta/estado`)
}

export function paperList(limit = 100): Promise<{ trades: PaperTrade[] }> {
  return feedFetch(`/paper/list?limit=${limit}`)
}

export function paperMetrics(): Promise<{ metrics: PaperMetrics }> {
  return feedFetch(`/paper/metrics`)
}

/** BTC → BTCUSDT (perp lineal). Ya-USDT se deja igual. */
export function toPerpSymbol(sym: string): string {
  const up = sym.toUpperCase()
  return up.endsWith('USDT') ? up : `${up}USDT`
}
