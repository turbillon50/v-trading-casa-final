'use client'

import { useMemo, useState } from 'react'
import { useCandles, type Timeframe } from '@/hooks/use-market'
import {
  ema as emaFn,
  rsi as rsiFn,
  macd as macdFn,
  bollinger as bollingerFn,
  vwap as vwapFn,
  pivotLevels,
  type Candle,
} from '@/lib/indicators'

const TIMEFRAMES: Timeframe[] = ['1m', '5m', '15m', '1H', '4H', '1D', '1W']

type IndKey = 'ema20' | 'ema50' | 'ema200' | 'boll' | 'vwap' | 'levels' | 'vol' | 'rsi' | 'macd'
const IND_LABELS: Record<IndKey, string> = {
  ema20: 'EMA 20',
  ema50: 'EMA 50',
  ema200: 'EMA 200',
  boll: 'Bollinger',
  vwap: 'VWAP',
  levels: 'S/R',
  vol: 'Volumen',
  rsi: 'RSI 14',
  macd: 'MACD',
}
const IND_COLORS: Partial<Record<IndKey, string>> = {
  ema20: '#FF2D87',              // rosa — acento principal
  ema50: '#22D3EE',              // cian
  ema200: '#A855F7',             // violeta
  boll: 'rgba(255,255,255,.22)', // blanco translúcido
  vwap: '#FFFFFF',               // blanco punteado
}

const GREEN = '#00E28A'   // velas alcistas / PNL positivo
const RED = '#FF3B4E'     // velas bajistas / PNL negativo

function fmtPrice(n: number): string {
  if (!isFinite(n)) return '—'
  return n.toLocaleString('en-US', {
    minimumFractionDigits: n >= 100 ? 1 : 4,
    maximumFractionDigits: n >= 100 ? 1 : 4,
  })
}
function fmtCompact(n: number): string {
  if (!isFinite(n)) return '—'
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B'
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M'
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K'
  return n.toFixed(0)
}

function linePath(values: number[], x: (i: number) => number, y: (v: number) => number): string {
  let d = ''
  let pen = false
  for (let i = 0; i < values.length; i++) {
    const v = values[i]
    if (isNaN(v)) { pen = false; continue }
    d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)} `
    pen = true
  }
  return d.trim()
}

export function CandlesChart({
  symbol = 'BTC',
  defaultTf = '1H',
  defaultInd = ['ema20', 'ema50', 'vol'],
}: {
  symbol?: string
  defaultTf?: Timeframe
  defaultInd?: IndKey[]
}) {
  const [tf, setTf] = useState<Timeframe>(defaultTf)
  const [active, setActive] = useState<Set<IndKey>>(new Set(defaultInd))
  const { candles, source, loading, error } = useCandles(symbol, tf)

  const toggle = (k: IndKey) =>
    setActive((prev) => {
      const n = new Set(prev)
      n.has(k) ? n.delete(k) : n.add(k)
      return n
    })

  const view = useMemo(() => candles.slice(-90), [candles])
  const closes = useMemo(() => view.map((c) => c.c), [view])

  const series = useMemo(() => {
    return {
      ema20: emaFn(closes, 20),
      ema50: emaFn(closes, 50),
      ema200: emaFn(closes, 200),
      boll: bollingerFn(closes, 20, 2),
      vwap: vwapFn(view),
      rsi: rsiFn(closes, 14),
      macd: macdFn(closes),
      levels: pivotLevels(view, 3, 3, 4),
    }
  }, [closes, view])

  const last = view[view.length - 1]
  const prevClose = view.length > 1 ? view[view.length - 2].c : last?.c
  const chg = last && prevClose ? ((last.c - prevClose) / prevClose) * 100 : 0

  const barsPerDay: Record<Timeframe, number> = { '1m': 1440, '5m': 288, '15m': 96, '1H': 24, '4H': 6, '1D': 1, '1W': 1 }
  const winStart = view.length - 1 - barsPerDay[tf]
  const dayRef = winStart >= 0 ? view[winStart].c : view[0]?.c
  const chg24 = last && dayRef ? ((last.c - dayRef) / dayRef) * 100 : 0

  const W = 960
  const padL = 8
  const padR = 62
  const plotW = W - padL - padR
  const n = view.length || 1
  const cw = plotW / n
  const bodyW = Math.max(1.5, cw * 0.62)
  const x = (i: number) => padL + i * cw + cw / 2

  const priceH = 300
  const volH = active.has('vol') ? 60 : 0
  const rsiH = active.has('rsi') ? 88 : 0
  const macdH = active.has('macd') ? 96 : 0
  const gap = 10

  const priceVals: number[] = []
  view.forEach((c) => { priceVals.push(c.h, c.l) })
  if (active.has('boll')) series.boll.upper.forEach((v) => !isNaN(v) && priceVals.push(v))
  if (active.has('boll')) series.boll.lower.forEach((v) => !isNaN(v) && priceVals.push(v))
  if (active.has('ema200')) series.ema200.forEach((v) => !isNaN(v) && priceVals.push(v))
  let pMin = Math.min(...priceVals)
  let pMax = Math.max(...priceVals)
  const padP = (pMax - pMin) * 0.06 || 1
  pMin -= padP
  pMax += padP
  const yP = (v: number) => 6 + ((pMax - v) / (pMax - pMin)) * (priceH - 12)

  const volMax = Math.max(...view.map((c) => c.v), 1)
  const volTop = priceH + gap
  const yV = (v: number) => volTop + (volH - 4) * (1 - v / volMax) + 2

  const rsiTop = volTop + volH + (volH ? gap : 0)
  const yR = (v: number) => rsiTop + (rsiH - 8) * (1 - v / 100) + 4

  const macdVals = [...series.macd.macd, ...series.macd.signal, ...series.macd.hist].filter((v) => !isNaN(v))
  const mMax = Math.max(...macdVals, 0.0001)
  const mMin = Math.min(...macdVals, -0.0001)
  const macdTop = rsiTop + rsiH + (rsiH ? gap : 0)
  const yM = (v: number) => macdTop + ((mMax - v) / (mMax - mMin)) * (macdH - 8) + 4

  const totalH = macdTop + macdH + 6
  const gridY = 4
  const hasData = view.length > 0 && !error

  return (
    <section className="vt-panel overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-border">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-[14px] font-mono font-semibold text-fg">{symbol}/USD</span>
          {hasData ? (
            <>
              <span className="text-[15px] font-mono nums text-fg tabular-nums">${fmtPrice(last.c)}</span>
              <span className={`text-[12px] font-mono nums ${chg24 >= 0 ? 'text-success' : 'text-error'}`}>
                {chg24 >= 0 ? '+' : ''}
                {chg24.toFixed(2)}% 24h
              </span>
            </>
          ) : (
            <span className="text-[12px] font-mono text-fg-3">{loading ? 'cargando…' : 'offline'}</span>
          )}
        </div>
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          {TIMEFRAMES.map((t) => (
            <button
              key={t}
              onClick={() => setTf(t)}
              className={`text-[11px] font-mono px-2 py-1 rounded transition-all duration-150 ${
                tf === t
                  ? 'bg-rose-soft text-rose'
                  : 'text-fg-3 hover:text-fg-2 active:scale-95'
              }`}
              aria-pressed={tf === t}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between px-4 py-1.5 border-b border-border/70">
        <span className="text-[9.5px] font-mono uppercase tracking-[0.14em] text-fg-3">
          {source ? `Precio de referencia · ${source}` : 'Precio de referencia'}
        </span>
        <span className="text-[9.5px] font-mono uppercase tracking-[0.14em] text-fg-3">
          Cuenta y ejecución · offline
        </span>
      </div>

      {/* Toggles de indicadores — entrada rosa desde izquierda al activar */}
      <div className="flex flex-wrap items-center gap-1.5 px-4 py-2.5 border-b border-border">
        {(Object.keys(IND_LABELS) as IndKey[]).map((k) => {
          const on = active.has(k)
          const c = IND_COLORS[k]
          return (
            <button
              key={k}
              onClick={() => toggle(k)}
              className={`inline-flex items-center gap-1.5 text-[10.5px] font-mono px-2 py-1 rounded-md border transition-all duration-200 active:scale-[.97] ${
                on
                  ? 'border-rose/40 bg-rose-soft text-fg font-semibold'
                  : 'border-border text-fg-3 hover:text-fg-2 hover:border-rose/20'
              }`}
              aria-pressed={on}
            >
              {c && <span className="w-2.5 h-0.5 rounded-full" style={{ background: on ? c : 'var(--fg-3)' }} />}
              {IND_LABELS[k]}
            </button>
          )
        })}
      </div>

      <div className="relative overflow-x-auto overflow-y-hidden custom-scrollbar" style={{ touchAction: 'pan-x' }}>
        {hasData ? (
          <svg
            viewBox={`0 0 ${W} ${totalH}`}
            width="100%"
            preserveAspectRatio="none"
            className="block min-w-[560px]"
            style={{ height: totalH * 0.9 }}
          >
            {Array.from({ length: gridY + 1 }).map((_, i) => {
              const v = pMax - (i / gridY) * (pMax - pMin)
              const yy = yP(v)
              return (
                <g key={i}>
                  <line x1={padL} y1={yy} x2={padL + plotW} y2={yy} stroke="var(--border)" strokeWidth="1" opacity="0.5" />
                  <text x={W - padR + 5} y={yy + 3} fontSize="9" fontFamily="var(--font-mono)" fill="var(--fg-3)">
                    {fmtPrice(v)}
                  </text>
                </g>
              )
            })}

            {active.has('boll') && (
              <>
                <path d={linePath(series.boll.upper, x, yP)} fill="none" stroke={IND_COLORS.boll} strokeWidth="1" />
                <path d={linePath(series.boll.lower, x, yP)} fill="none" stroke={IND_COLORS.boll} strokeWidth="1" />
                <path d={linePath(series.boll.mid, x, yP)} fill="none" stroke={IND_COLORS.boll} strokeWidth="0.75" strokeDasharray="3 3" />
              </>
            )}

            {active.has('levels') && (
              <>
                {series.levels.resistance.map((lv, i) => (
                  <line key={`r${i}`} x1={padL} y1={yP(lv)} x2={padL + plotW} y2={yP(lv)} stroke={RED} strokeWidth="0.75" strokeDasharray="2 4" opacity="0.5" />
                ))}
                {series.levels.support.map((lv, i) => (
                  <line key={`s${i}`} x1={padL} y1={yP(lv)} x2={padL + plotW} y2={yP(lv)} stroke={GREEN} strokeWidth="0.75" strokeDasharray="2 4" opacity="0.5" />
                ))}
              </>
            )}

            {view.map((c, i) => {
              const up = c.c >= c.o
              const col = up ? GREEN : RED
              const bx = x(i) - bodyW / 2
              const yo = yP(c.o)
              const yc = yP(c.c)
              const top = Math.min(yo, yc)
              const h = Math.max(1, Math.abs(yc - yo))
              return (
                <g key={i}>
                  <line x1={x(i)} y1={yP(c.h)} x2={x(i)} y2={yP(c.l)} stroke={col} strokeWidth="1" />
                  <rect x={bx} y={top} width={bodyW} height={h} fill={col} />
                </g>
              )
            })}

            {active.has('vwap') && (
              <path d={linePath(series.vwap, x, yP)} fill="none" stroke={IND_COLORS.vwap} strokeWidth="1" strokeDasharray="4 3" opacity="0.7" />
            )}
            {active.has('ema20') && (
              <path d={linePath(series.ema20, x, yP)} fill="none" stroke={IND_COLORS.ema20} strokeWidth="1.4" />
            )}
            {active.has('ema50') && (
              <path d={linePath(series.ema50, x, yP)} fill="none" stroke={IND_COLORS.ema50} strokeWidth="1.4" />
            )}
            {active.has('ema200') && (
              <path d={linePath(series.ema200, x, yP)} fill="none" stroke={IND_COLORS.ema200} strokeWidth="1.4" />
            )}

            {last && (
              <g>
                <line
                  x1={padL} y1={yP(last.c)}
                  x2={padL + plotW} y2={yP(last.c)}
                  stroke={chg >= 0 ? GREEN : RED}
                  strokeWidth="0.75" strokeDasharray="2 2" opacity="0.7"
                />
                <rect x={W - padR + 1} y={yP(last.c) - 7} width={padR - 2} height="14" fill={chg >= 0 ? GREEN : RED} rx="2" />
                <text x={W - padR + 5} y={yP(last.c) + 3} fontSize="9" fontFamily="var(--font-mono)" fill="#000000" fontWeight="600">
                  {fmtPrice(last.c)}
                </text>
              </g>
            )}

            {active.has('vol') && (
              <g>
                {view.map((c, i) => {
                  const up = c.c >= c.o
                  return <rect key={i} x={x(i) - bodyW / 2} y={yV(c.v)} width={bodyW} height={volTop + volH - yV(c.v)} fill={up ? GREEN : RED} opacity="0.4" />
                })}
                <text x={padL + 2} y={volTop + 10} fontSize="9" fontFamily="var(--font-mono)" fill="var(--fg-3)">
                  VOL {fmtCompact(last.v)}
                </text>
              </g>
            )}

            {active.has('rsi') && (
              <g>
                <line x1={padL} y1={yR(70)} x2={padL + plotW} y2={yR(70)} stroke={RED} strokeWidth="0.75" strokeDasharray="3 3" opacity="0.45" />
                <line x1={padL} y1={yR(30)} x2={padL + plotW} y2={yR(30)} stroke={GREEN} strokeWidth="0.75" strokeDasharray="3 3" opacity="0.45" />
                <line x1={padL} y1={yR(50)} x2={padL + plotW} y2={yR(50)} stroke="var(--border)" strokeWidth="0.75" opacity="0.6" />
                {/* RSI en cian */}
                <path d={linePath(series.rsi, x, yR)} fill="none" stroke="#22D3EE" strokeWidth="1.3" />
                <text x={padL + 2} y={rsiTop + 10} fontSize="9" fontFamily="var(--font-mono)" fill="var(--fg-3)">
                  RSI {series.rsi.filter((v) => !isNaN(v)).slice(-1)[0]?.toFixed(0) ?? '—'}
                </text>
              </g>
            )}

            {active.has('macd') && (
              <g>
                <line x1={padL} y1={yM(0)} x2={padL + plotW} y2={yM(0)} stroke="var(--border)" strokeWidth="0.75" opacity="0.6" />
                {series.macd.hist.map((v, i) =>
                  isNaN(v) ? null : (
                    <rect
                      key={i}
                      x={x(i) - bodyW / 2}
                      y={Math.min(yM(v), yM(0))}
                      width={bodyW}
                      height={Math.max(1, Math.abs(yM(v) - yM(0)))}
                      fill={v >= 0 ? GREEN : RED}
                      opacity="0.5"
                    />
                  ),
                )}
                {/* MACD rosa, signal cian */}
                <path d={linePath(series.macd.macd, x, yM)} fill="none" stroke="#FF2D87" strokeWidth="1.2" />
                <path d={linePath(series.macd.signal, x, yM)} fill="none" stroke="#22D3EE" strokeWidth="1.2" />
                <text x={padL + 2} y={macdTop + 10} fontSize="9" fontFamily="var(--font-mono)" fill="var(--fg-3)">
                  MACD 12,26,9
                </text>
              </g>
            )}
          </svg>
        ) : (
          <div className="h-[280px] flex items-center justify-center px-6">
            <div className="text-center max-w-[340px]">
              <div className="text-[13px] font-medium text-fg-2">
                {loading ? 'Cargando velas de referencia…' : 'Sin datos de mercado'}
              </div>
              <p className="text-[11.5px] text-fg-3 leading-relaxed mt-1.5">
                {loading
                  ? 'Trayendo velas reales de Coinbase (respaldo OKX).'
                  : 'Las fuentes de referencia (Coinbase / OKX) no respondieron. No dibujamos velas inventadas; reintenta en un momento.'}
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
