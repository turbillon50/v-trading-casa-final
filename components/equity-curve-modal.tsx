'use client'

/**
 * EquityCurveModal — visor full-screen de la curva de equity de Luis.
 *
 * Diseño "primer nivel" (Luis: "que sea de primer nivel, no algo corriente"):
 *   - chart enorme con tooltip elegante al hover
 *   - selector de timeframe: 1H, 6H, 24H, 7D, 30D, ALL
 *   - YAxis con domain auto (la curva NO se ve plana aunque varíe poco)
 *   - reference line en ATH y mínimo
 *   - stats: ATH, drawdown actual, max gain, % desde inicio
 *   - brush al fondo para zoom granular
 *   - smooth animations + gradients premium
 */

import { motion } from 'framer-motion'
import { X, TrendingUp, TrendingDown, Target } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import {
  Area,
  AreaChart,
  Brush,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { api, type BalanceSnapshot } from '@/lib/api'

const RANGES = [
  { id: '1h', label: '1H', limit: 30 },
  { id: '6h', label: '6H', limit: 80 },
  { id: '24h', label: '24H', limit: 300 },
  { id: '7d', label: '7D', limit: 1000 },
  { id: '30d', label: '30D', limit: 3000 },
  { id: 'all', label: 'ALL', limit: 10000 },
] as const

type RangeId = (typeof RANGES)[number]['id']

interface Point {
  ts: number
  value: number
  label: string
}

interface EquityCurveModalProps {
  isOpen: boolean
  onClose: () => void
  currentEquity: number
}

function formatTime(ts: number, range: RangeId): string {
  const d = new Date(ts)
  if (range === '1h' || range === '6h' || range === '24h') {
    return d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })
}

function formatTimeFull(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleString('es-MX', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{ payload: Point; value: number }>
}) {
  if (!active || !payload || payload.length === 0) return null
  const p = payload[0].payload
  return (
    <div className="rounded-xl border border-amber/30 bg-black/90 backdrop-blur-md px-3 py-2 shadow-2xl">
      <div className="text-[10px] uppercase tracking-wider text-amber font-mono mb-0.5">
        {formatTimeFull(p.ts)}
      </div>
      <div className="text-[18px] font-mono tabular-nums text-fg font-semibold">
        ${p.value.toFixed(2)}
      </div>
    </div>
  )
}

export function EquityCurveModal({
  isOpen,
  onClose,
  currentEquity,
}: EquityCurveModalProps) {
  const [snapshots, setSnapshots] = useState<BalanceSnapshot[]>([])
  const [loading, setLoading] = useState(true)
  const [range, setRange] = useState<RangeId>('24h')

  useEffect(() => {
    if (!isOpen) return
    let mounted = true
    setLoading(true)
    const limit = RANGES.find((r) => r.id === range)?.limit ?? 300
    api
      .balanceSnapshots(limit)
      .then((r) => {
        if (mounted) setSnapshots(r.snapshots ?? [])
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [isOpen, range])

  const data: Point[] = useMemo(() => {
    return snapshots
      .map((s) => {
        const ts = new Date(s.createdAt).getTime()
        const value = parseFloat(s.equity ?? s.balance ?? '0') || 0
        return { ts, value, label: formatTime(ts, range) }
      })
      .filter((p) => p.value > 0 && Number.isFinite(p.ts))
  }, [snapshots, range])

  const stats = useMemo(() => {
    if (data.length === 0) {
      return { ath: 0, atl: 0, first: 0, last: currentEquity, change: 0, drawdown: 0 }
    }
    const values = data.map((d) => d.value)
    const ath = Math.max(...values)
    const atl = Math.min(...values)
    const first = data[0].value
    const last = data[data.length - 1].value
    const change = first > 0 ? ((last - first) / first) * 100 : 0
    const drawdown = ath > 0 ? ((last - ath) / ath) * 100 : 0
    return { ath, atl, first, last, change, drawdown }
  }, [data, currentEquity])

  // Padding del YAxis para que la curva NUNCA se vea plana aunque varíe poco
  const yDomain = useMemo<[number, number]>(() => {
    if (data.length < 2) return [0, currentEquity * 1.1]
    const values = data.map((d) => d.value)
    const min = Math.min(...values)
    const max = Math.max(...values)
    const range = max - min
    const pad = range > 0 ? range * 0.15 : max * 0.05
    return [Math.max(0, min - pad), max + pad]
  }, [data, currentEquity])

  // Decimales adaptativos del eje Y: cuando el rango es pequeño (~$0.20 en
  // ventana 1H), toFixed(0) hace que todos los ticks digan lo mismo ($46).
  // Usamos decimales según el rango real para que cada tick sea distinto.
  const yDecimals = useMemo(() => {
    const range = yDomain[1] - yDomain[0]
    if (range >= 100) return 0
    if (range >= 10) return 1
    if (range >= 1) return 2
    return 3
  }, [yDomain])

  // Texto contextual para que Luis entienda si la curva es ruido o movimiento real
  const rangePct = useMemo(() => {
    if (data.length < 2) return 0
    const values = data.map((d) => d.value)
    const min = Math.min(...values)
    const max = Math.max(...values)
    if (min === 0) return 0
    return ((max - min) / min) * 100
  }, [data])

  const isPositive = stats.change >= 0

  if (!isOpen) return null

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] bg-black/85 backdrop-blur-md flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 280, damping: 28 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-5xl max-h-[92vh] overflow-y-auto rounded-3xl border border-border bg-bg-1/98 backdrop-blur-2xl shadow-2xl"
      >
        {/* Glow ambient */}
        <div
          className="absolute inset-0 opacity-25 pointer-events-none rounded-3xl"
          style={{
            background:
              'radial-gradient(ellipse at 50% 0%, var(--amber-soft) 0%, transparent 55%)',
          }}
        />

        <div className="relative p-6 md:p-8">
          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-fg-3 font-mono mb-1.5">
                Curva de equity
              </div>
              <div className="flex items-baseline gap-3">
                <div className="text-[34px] font-semibold font-mono tabular-nums text-fg leading-none">
                  ${stats.last.toFixed(2)}
                </div>
                <div
                  className={`flex items-center gap-1 text-[15px] font-mono tabular-nums ${
                    isPositive ? 'text-success' : 'text-error'
                  }`}
                >
                  {isPositive ? (
                    <TrendingUp className="w-4 h-4" />
                  ) : (
                    <TrendingDown className="w-4 h-4" />
                  )}
                  {isPositive ? '+' : ''}
                  {stats.change.toFixed(2)}%
                </div>
              </div>
              <div className="text-[11px] text-fg-3 font-mono mt-1">
                en ventana {RANGES.find((r) => r.id === range)?.label.toLowerCase()}
                {rangePct > 0 && (
                  <span className="ml-2">
                    · rango {rangePct.toFixed(2)}%
                    {rangePct < 0.5 && <span className="text-fg-3/70"> (ruido, casi plano)</span>}
                    {rangePct >= 0.5 && rangePct < 2 && <span className="text-fg-3/70"> (movimiento pequeño)</span>}
                    {rangePct >= 2 && rangePct < 5 && <span className="text-amber/70"> (movimiento normal)</span>}
                    {rangePct >= 5 && <span className="text-error/70"> (movimiento fuerte)</span>}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-fg-3 hover:text-fg hover:bg-bg-2 transition-colors"
              aria-label="Cerrar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Range selector */}
          <div className="flex gap-1 mb-5 overflow-x-auto custom-scrollbar pb-1">
            {RANGES.map((r) => (
              <button
                key={r.id}
                onClick={() => setRange(r.id)}
                className={`px-3 py-1.5 rounded-lg text-[12px] font-mono uppercase tracking-wider transition-all whitespace-nowrap ${
                  range === r.id
                    ? 'bg-amber text-black font-semibold'
                    : 'bg-bg-2 text-fg-3 hover:bg-bg-3 hover:text-fg-1'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          {/* Chart */}
          <div className="bg-bg-2/30 rounded-2xl p-3 border border-border/50 mb-5">
            {loading ? (
              <div className="h-[400px] flex items-center justify-center text-[13px] text-fg-3 font-mono">
                cargando…
              </div>
            ) : data.length < 2 ? (
              <div className="h-[400px] flex items-center justify-center text-[13px] text-fg-3 font-mono">
                construyendo histórico — necesito 2+ snapshots
              </div>
            ) : (
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={data}
                    margin={{ top: 16, right: 18, left: 4, bottom: 4 }}
                  >
                    <defs>
                      <linearGradient id="equityGradFull" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--amber)" stopOpacity={0.55} />
                        <stop offset="60%" stopColor="var(--amber)" stopOpacity={0.18} />
                        <stop offset="100%" stopColor="var(--amber)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      stroke="var(--border)"
                      strokeDasharray="2 4"
                      vertical={false}
                      opacity={0.4}
                    />
                    <XAxis
                      dataKey="label"
                      stroke="var(--fg-3)"
                      tick={{ fontSize: 10, fontFamily: 'monospace' }}
                      interval="preserveStartEnd"
                      minTickGap={48}
                    />
                    <YAxis
                      stroke="var(--fg-3)"
                      tick={{ fontSize: 10, fontFamily: 'monospace' }}
                      domain={yDomain}
                      tickFormatter={(v: number) => `$${v.toFixed(yDecimals)}`}
                      width={64}
                    />
                    <Tooltip
                      content={<CustomTooltip />}
                      cursor={{
                        stroke: 'var(--amber)',
                        strokeWidth: 1,
                        strokeDasharray: '3 3',
                        opacity: 0.6,
                      }}
                    />
                    {stats.ath > 0 && (
                      <ReferenceLine
                        y={stats.ath}
                        stroke="var(--success)"
                        strokeDasharray="2 4"
                        strokeOpacity={0.5}
                        label={{
                          value: `ATH $${stats.ath.toFixed(2)}`,
                          position: 'insideTopRight',
                          fill: 'var(--success)',
                          fontSize: 10,
                          fontFamily: 'monospace',
                        }}
                      />
                    )}
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="var(--amber)"
                      strokeWidth={2}
                      fill="url(#equityGradFull)"
                      isAnimationActive={true}
                      animationDuration={500}
                      activeDot={{
                        r: 5,
                        fill: 'var(--amber)',
                        stroke: 'var(--bg)',
                        strokeWidth: 2,
                      }}
                    />
                    {data.length > 50 && (
                      <Brush
                        dataKey="label"
                        height={24}
                        stroke="var(--amber)"
                        fill="var(--bg-2)"
                        travellerWidth={8}
                      />
                    )}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard
              label="ATH"
              value={`$${stats.ath.toFixed(2)}`}
              accent="success"
              icon={<Target className="w-3 h-3" />}
            />
            <StatCard
              label="Mínimo"
              value={`$${stats.atl.toFixed(2)}`}
              accent="error"
            />
            <StatCard
              label="Drawdown actual"
              value={`${stats.drawdown.toFixed(2)}%`}
              accent={stats.drawdown < 0 ? 'error' : 'fg'}
            />
            <StatCard
              label="Snapshots"
              value={`${data.length}`}
              accent="fg"
              hint="puntos cargados"
            />
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

function StatCard({
  label,
  value,
  accent,
  hint,
  icon,
}: {
  label: string
  value: string
  accent: 'success' | 'error' | 'fg' | 'amber'
  hint?: string
  icon?: React.ReactNode
}) {
  const colorClass = {
    success: 'text-success',
    error: 'text-error',
    fg: 'text-fg',
    amber: 'text-amber',
  }[accent]

  return (
    <div className="bg-bg-2/40 rounded-xl p-3 border border-border/40">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-fg-3 mb-1.5 font-mono">
        {icon}
        {label}
      </div>
      <div className={`text-[16px] font-mono tabular-nums font-semibold ${colorClass}`}>
        {value}
      </div>
      {hint && (
        <div className="text-[10px] text-fg-3 font-mono mt-0.5">{hint}</div>
      )}
    </div>
  )
}
