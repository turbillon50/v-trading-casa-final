'use client'

/**
 * LiveSidebar — panel "Live" con tu cuenta, mercado y actividad de Tanit
 * en tiempo real.
 *
 * Diseño nuevo (Luis: "lo que tengo no me ayuda en casi nada"):
 *
 *   1. Card YO       — equity grande + Δ% del primer snapshot + curva real
 *                       de los últimos snapshots. Si hay posiciones, muestra
 *                       desglose (en pos / disponible).
 *   2. Card MERCADO  — BTC/ETH/SOL precio + Δ24h + dot live (refresh 5s).
 *   3. Card POS      — si 0: mensaje "esperando setup según Tesis 5.1".
 *                       si N>0: lista de posiciones, click → detalle.
 *   4. Card TANIT    — última decisión registrada (qué pensó/hizo).
 *
 * Refresh: 5s mercado + posiciones, 15s equity snapshots, 30s decisions.
 * Cada card tiene un dot pulsante para feedback de "viva, tickeando ahora".
 */

import { motion } from 'framer-motion'
import { X, TrendingUp, TrendingDown, Activity, Maximize2 } from 'lucide-react'
import { Area, AreaChart, ResponsiveContainer, YAxis } from 'recharts'
import { useEffect, useState } from 'react'
import {
  api,
  type PortfolioBalance,
  type PortfolioPosition,
  type BalanceSnapshot,
  type TanitDecision,
} from '@/lib/api'
import { EquityCurveModal } from '@/components/equity-curve-modal'

interface LiveSidebarProps {
  isOpen?: boolean
  onClose?: () => void
}

const SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'] as const
type Symbol = (typeof SYMBOLS)[number]

// ─── pulsing dot ─────────────────────────────────────────────────────────
function LiveDot({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-block w-1.5 h-1.5 rounded-full bg-amber animate-pulse ${className}`}
      style={{ boxShadow: '0 0 6px var(--amber-glow)' }}
    />
  )
}

// ─── card YO (equity consolidada) ────────────────────────────────────────
function MyAccountCard() {
  const [balance, setBalance] = useState<PortfolioBalance | null>(null)
  const [positions, setPositions] = useState<PortfolioPosition[]>([])
  const [snaps, setSnaps] = useState<BalanceSnapshot[]>([])
  const [tick, setTick] = useState(0)
  const [chartOpen, setChartOpen] = useState(false)

  useEffect(() => {
    let mounted = true
    const tickInterval = setInterval(() => mounted && setTick((t) => t + 1), 5_000)
    return () => {
      mounted = false
      clearInterval(tickInterval)
    }
  }, [])

  useEffect(() => {
    let mounted = true
    Promise.all([
      api.balance().catch(() => null),
      api.positions().catch(() => [] as PortfolioPosition[]),
    ]).then(([b, ps]) => {
      if (!mounted) return
      setBalance(b)
      setPositions(ps ?? [])
    })
    return () => {
      mounted = false
    }
  }, [tick])

  useEffect(() => {
    let mounted = true
    api
      .balanceSnapshots(300)
      .then((r) => {
        if (mounted) setSnaps(r.snapshots ?? [])
      })
      .catch(() => {})
    const id = setInterval(() => {
      api
        .balanceSnapshots(300)
        .then((r) => {
          if (mounted) setSnaps(r.snapshots ?? [])
        })
        .catch(() => {})
    }, 15_000)
    return () => {
      mounted = false
      clearInterval(id)
    }
  }, [])

  const equity = balance?.totalEquity ?? 0
  const available = balance?.availableBalance ?? 0
  const upnl = balance?.unrealizedPnl ?? 0
  const inPositions = Math.max(0, equity - available)
  const isTestnet = balance?.testnet ?? false

  // Δ% vs primer snapshot
  const chartData =
    snaps.length >= 2
      ? snaps
          .slice()
          .reverse()
          .map((s, i) => ({
            time: i,
            value: parseFloat(s.equity ?? s.balance ?? '0') || 0,
          }))
      : []
  const first = chartData[0]?.value ?? equity
  const change = first > 0 ? ((equity - first) / first) * 100 : 0
  const isPositive = change >= 0

  return (
    <div className="relative rounded-2xl overflow-hidden bg-bg-1 dark:bg-[#080808] border border-border">
      <div
        className="absolute inset-0 opacity-30 dark:opacity-40 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at 50% 80%, var(--amber-soft) 0%, transparent 60%)',
        }}
      />
      <div className="relative p-5">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <LiveDot />
            <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-fg-3">
              Mi cuenta {isTestnet ? '· TESTNET' : '· MAINNET'}
            </span>
          </div>
          {chartData.length >= 2 && (
            <span
              className={`text-[12px] font-mono tabular-nums ${
                isPositive ? 'text-success' : 'text-error'
              }`}
            >
              {isPositive ? '+' : ''}
              {change.toFixed(2)}%
            </span>
          )}
        </div>
        <div className="text-[28px] font-semibold font-mono tabular-nums text-fg tracking-[-0.02em] leading-tight">
          ${equity.toFixed(2)}
        </div>
        <div className="text-[11px] text-fg-3 mb-3">total · incluye PnL no realizado</div>

        {/* Chart — clickeable abre vista full-screen */}
        {chartData.length >= 2 ? (
          <button
            type="button"
            onClick={() => setChartOpen(true)}
            className="group relative w-full h-24 -mx-2 rounded-lg hover:bg-amber/5 transition-colors cursor-pointer"
            aria-label="Expandir curva de equity"
            title="Click para ver curva completa"
          >
            <ResponsiveContainer width="100%" height={96}>
              <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 4 }}>
                <defs>
                  <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--amber)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="var(--amber)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                {/* YAxis hidden con domain auto-padded — la curva se ve VIVA aunque varíe poco */}
                <YAxis
                  hide
                  domain={[
                    (dataMin: number) => {
                      const max = Math.max(...chartData.map((d) => d.value))
                      const range = max - dataMin
                      const pad = range > 0 ? range * 0.2 : max * 0.05
                      return Math.max(0, dataMin - pad)
                    },
                    (dataMax: number) => {
                      const min = Math.min(...chartData.map((d) => d.value))
                      const range = dataMax - min
                      const pad = range > 0 ? range * 0.2 : dataMax * 0.05
                      return dataMax + pad
                    },
                  ]}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="var(--amber)"
                  strokeWidth={1.8}
                  fill="url(#equityGradient)"
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
            <div className="absolute top-1.5 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <Maximize2 className="w-3.5 h-3.5 text-amber" />
            </div>
          </button>
        ) : (
          <div className="h-24 flex items-center justify-center text-[11px] text-fg-3">
            construyendo histórico…
          </div>
        )}

        <EquityCurveModal
          isOpen={chartOpen}
          onClose={() => setChartOpen(false)}
          currentEquity={equity}
        />

        {/* Desglose solo si hay posiciones abiertas */}
        {positions.length > 0 && (
          <div className="mt-3 pt-3 border-t border-border space-y-1.5">
            <div className="flex justify-between text-[12px]">
              <span className="text-fg-3">en posiciones</span>
              <span className="font-mono tabular-nums text-fg-1">
                ${inPositions.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-[12px]">
              <span className="text-fg-3">disponible</span>
              <span className="font-mono tabular-nums text-fg-1">
                ${available.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-[12px]">
              <span className="text-fg-3">PnL no realizado</span>
              <span
                className={`font-mono tabular-nums ${
                  upnl >= 0 ? 'text-success' : 'text-error'
                }`}
              >
                {upnl >= 0 ? '+' : ''}${upnl.toFixed(2)}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── card MERCADO ────────────────────────────────────────────────────────
interface SymbolTick {
  symbol: Symbol
  price: number | null
  change: number | null
  loading: boolean
}

function MarketCard() {
  const [ticks, setTicks] = useState<SymbolTick[]>(() =>
    SYMBOLS.map((s) => ({ symbol: s, price: null, change: null, loading: true })),
  )
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)

  useEffect(() => {
    let mounted = true
    async function load() {
      const results = await Promise.all(
        SYMBOLS.map(async (s) => {
          try {
            const t = await api.ticker(s)
            return {
              symbol: s,
              price: t.price ?? null,
              change: t.changePercent24h ?? null,
              loading: false,
            }
          } catch {
            return { symbol: s, price: null, change: null, loading: false }
          }
        }),
      )
      if (mounted) {
        setTicks(results)
        setUpdatedAt(new Date())
      }
    }
    load()
    const id = setInterval(load, 5_000)
    return () => {
      mounted = false
      clearInterval(id)
    }
  }, [])

  return (
    <div className="relative rounded-2xl overflow-hidden bg-bg-1 dark:bg-[#080808] border border-border">
      <div className="relative p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <LiveDot />
            <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-fg-3">
              Mercado
            </span>
          </div>
          {updatedAt && (
            <span className="text-[10px] font-mono text-fg-3 tabular-nums">
              {updatedAt.toLocaleTimeString('es-MX', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              })}
            </span>
          )}
        </div>

        <div className="space-y-2.5">
          {ticks.map((t) => {
            const isPos = (t.change ?? 0) >= 0
            return (
              <div key={t.symbol} className="flex items-center justify-between">
                <span className="text-[13px] font-mono text-fg">
                  {t.symbol.replace('USDT', '')}
                </span>
                <div className="flex items-baseline gap-3">
                  <span className="text-[14px] font-mono tabular-nums text-fg">
                    {t.price !== null
                      ? t.price >= 100
                        ? `$${t.price.toFixed(2)}`
                        : `$${t.price.toFixed(4)}`
                      : '—'}
                  </span>
                  {t.change !== null && (
                    <span
                      className={`text-[11px] font-mono tabular-nums ${
                        isPos ? 'text-success' : 'text-error'
                      }`}
                    >
                      {isPos ? '+' : ''}
                      {t.change.toFixed(2)}%
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── card POSICIONES ────────────────────────────────────────────────────
function PositionsCard({ onSelect }: { onSelect: (p: PortfolioPosition) => void }) {
  const [positions, setPositions] = useState<PortfolioPosition[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    async function load() {
      try {
        const r = await api.positions()
        if (!mounted) return
        setPositions(r ?? [])
      } catch {
        /* keep last */
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    const id = setInterval(load, 5_000)
    return () => {
      mounted = false
      clearInterval(id)
    }
  }, [])

  return (
    <div className="relative rounded-2xl overflow-hidden bg-bg-1 dark:bg-[#080808] border border-border">
      <div className="relative p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <LiveDot />
            <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-fg-3">
              Posiciones
            </span>
          </div>
          <span className="text-[11px] font-mono bg-bg-2 px-2.5 py-0.5 rounded-full text-fg-1 border border-border">
            {loading ? '…' : positions.length}
          </span>
        </div>

        {positions.length === 0 ? (
          <div className="py-3">
            <div className="text-[13px] text-fg-1 font-medium mb-1">
              {loading ? 'cargando…' : 'esperando setup'}
            </div>
            <div className="text-[11px] text-fg-3 leading-relaxed">
              Tanit no entra hasta que precio + volumen + funding confirmen la
              dirección (Motor 1, Tesis 5.1).
            </div>
          </div>
        ) : (
          <div className="space-y-2.5">
            {positions.map((pos) => {
              const isLong = pos.side === 'Buy'
              const pnl = pos.unrealizedPnl ?? 0
              const pnlPct = pos.unrealizedPnlPercent ?? 0
              return (
                <button
                  key={pos.symbol + pos.side}
                  onClick={() => onSelect(pos)}
                  className="w-full flex items-center justify-between gap-3 p-2 -mx-1 rounded-lg hover:bg-bg-2 transition-colors text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-1 h-7 rounded-full flex-shrink-0 ${
                        isLong
                          ? 'bg-gradient-to-b from-success to-success/70'
                          : 'bg-gradient-to-b from-error to-error/70'
                      }`}
                    />
                    <div className="flex flex-col min-w-0">
                      <span className="text-[13px] font-mono text-fg truncate">
                        {pos.symbol.replace('USDT', '')} {isLong ? 'LONG' : 'SHORT'}
                      </span>
                      <span className="text-[10px] text-fg-3 font-mono">
                        {Math.round(pos.leverage)}x · ${pos.size}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {pnl >= 0 ? (
                      <TrendingUp className="w-3.5 h-3.5 text-success" />
                    ) : (
                      <TrendingDown className="w-3.5 h-3.5 text-error" />
                    )}
                    <div className="flex flex-col items-end">
                      <span
                        className={`text-[13px] font-mono tabular-nums ${
                          pnl >= 0 ? 'text-success' : 'text-error'
                        }`}
                      >
                        {pnl >= 0 ? '+' : ''}${Math.abs(pnl).toFixed(2)}
                      </span>
                      <span
                        className={`text-[10px] font-mono tabular-nums ${
                          pnlPct >= 0 ? 'text-success/80' : 'text-error/80'
                        }`}
                      >
                        {pnlPct >= 0 ? '+' : ''}
                        {pnlPct.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── card TANIT (última decisión) ───────────────────────────────────────
function TanitNowCard() {
  const [decision, setDecision] = useState<TanitDecision | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    async function load() {
      try {
        const r = await api.decisions(1)
        if (!mounted) return
        setDecision(r.decisions?.[0] ?? null)
      } catch {
        /* keep last */
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    const id = setInterval(load, 30_000)
    return () => {
      mounted = false
      clearInterval(id)
    }
  }, [])

  const verdictColor = (v: string) => {
    if (v === 'executed') return 'text-success'
    if (v === 'blocked' || v === 'rejected') return 'text-error'
    if (v === 'needs_confirmation') return 'text-amber'
    return 'text-fg-1'
  }

  const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime()
    if (diff < 60_000) return 'ahora'
    if (diff < 3_600_000) return `hace ${Math.floor(diff / 60_000)} min`
    if (diff < 86_400_000) return `hace ${Math.floor(diff / 3_600_000)} h`
    return `hace ${Math.floor(diff / 86_400_000)} d`
  }

  return (
    <div className="relative rounded-2xl overflow-hidden bg-bg-1 dark:bg-[#080808] border border-border">
      <div className="relative p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Activity className="w-3 h-3 text-amber" />
            <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-fg-3">
              Tanit · última actividad
            </span>
          </div>
        </div>

        {loading ? (
          <div className="text-[12px] text-fg-3 font-mono">cargando…</div>
        ) : !decision ? (
          <div className="text-[12px] text-fg-3 leading-relaxed">
            Aún no ha tomado decisiones registradas. Cuando ella opere o
            evalúe un setup, va a aparecer aquí.
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[13px] text-fg-1 truncate">
                {decision.decision_type}
                {decision.symbol ? ` · ${decision.symbol.replace('USDT', '')}` : ''}
              </span>
              <span
                className={`text-[11px] font-mono uppercase ${verdictColor(decision.verdict)}`}
              >
                {decision.verdict}
              </span>
            </div>
            {decision.thesis && (
              <p className="text-[12px] text-fg-2 leading-snug line-clamp-3">
                {decision.thesis}
              </p>
            )}
            <div className="text-[10px] font-mono text-fg-3">
              {timeAgo(decision.created_at)}
              {decision.model_used ? ` · ${decision.model_used}` : ''}
              {decision.latency_ms != null ? ` · ${decision.latency_ms}ms` : ''}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── modal detalle posición ─────────────────────────────────────────────
function PositionDetailModal({
  pos,
  onClose,
}: {
  pos: PortfolioPosition | null
  onClose: () => void
}) {
  if (!pos) return null
  const isLong = pos.side === 'Buy'
  const pnl = pos.unrealizedPnl ?? 0
  const pnlPct = pos.unrealizedPnlPercent ?? 0

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[55] bg-black/70 backdrop-blur-md flex items-center justify-center px-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 280, damping: 28 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-3xl border border-border bg-bg-1/95 backdrop-blur-2xl p-6 shadow-2xl"
      >
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div
              className={`w-2 h-9 rounded-full ${
                isLong ? 'bg-success' : 'bg-error'
              }`}
            />
            <div>
              <div className="text-[18px] font-semibold text-fg">
                {pos.symbol.replace('USDT', '')} {isLong ? 'LONG' : 'SHORT'}
              </div>
              <div className="text-[11px] text-fg-3 font-mono">
                {Math.round(pos.leverage)}x leverage
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-fg-3 hover:text-fg hover:bg-bg-2"
            aria-label="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-bg-2/40 rounded-xl p-3">
            <div className="text-[10px] uppercase tracking-wider text-fg-3 mb-1">
              PnL
            </div>
            <div
              className={`text-[20px] font-mono tabular-nums ${
                pnl >= 0 ? 'text-success' : 'text-error'
              }`}
            >
              {pnl >= 0 ? '+' : ''}${Math.abs(pnl).toFixed(2)}
            </div>
            <div
              className={`text-[12px] font-mono ${
                pnlPct >= 0 ? 'text-success/80' : 'text-error/80'
              }`}
            >
              {pnlPct >= 0 ? '+' : ''}
              {pnlPct.toFixed(2)}%
            </div>
          </div>
          <div className="bg-bg-2/40 rounded-xl p-3">
            <div className="text-[10px] uppercase tracking-wider text-fg-3 mb-1">
              Tamaño
            </div>
            <div className="text-[20px] font-mono tabular-nums text-fg">
              ${pos.size}
            </div>
            <div className="text-[12px] font-mono text-fg-3">notional</div>
          </div>
        </div>

        <div className="space-y-2 text-[13px]">
          <div className="flex justify-between">
            <span className="text-fg-3">Entrada</span>
            <span className="font-mono tabular-nums text-fg">
              ${pos.entryPrice.toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-fg-3">Mark</span>
            <span className="font-mono tabular-nums text-fg">
              ${pos.markPrice.toFixed(2)}
            </span>
          </div>
          {pos.stopLoss != null && (
            <div className="flex justify-between">
              <span className="text-fg-3">Stop loss</span>
              <span className="font-mono tabular-nums text-error">
                ${pos.stopLoss.toFixed(2)}
              </span>
            </div>
          )}
          {pos.takeProfit != null && (
            <div className="flex justify-between">
              <span className="text-fg-3">Take profit</span>
              <span className="font-mono tabular-nums text-success">
                ${pos.takeProfit.toFixed(2)}
              </span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-fg-3">Liquidación</span>
            <span className="font-mono tabular-nums text-amber">
              ${pos.liquidationPrice.toFixed(2)}
            </span>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─── sidebar root ───────────────────────────────────────────────────────
export function LiveSidebar({ isOpen = true, onClose }: LiveSidebarProps) {
  const [selectedPos, setSelectedPos] = useState<PortfolioPosition | null>(null)

  const sidebarContent = (
    <div className="flex flex-col h-full p-5 overflow-y-auto custom-scrollbar">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <LiveDot />
          <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-fg-3">
            Live
          </span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-bg-2 transition-colors lg:hidden"
            aria-label="Cerrar panel"
          >
            <X className="w-4 h-4 text-fg-3" />
          </button>
        )}
      </div>

      <div className="space-y-4 flex-1">
        <MyAccountCard />
        <MarketCard />
        <PositionsCard onSelect={setSelectedPos} />
        <TanitNowCard />
      </div>

      <div className="mt-5 pt-3 border-t border-border">
        <span className="text-[10px] font-mono text-fg-3 tracking-wide">
          tickeando · 5–15s
        </span>
      </div>

      <PositionDetailModal pos={selectedPos} onClose={() => setSelectedPos(null)} />
    </div>
  )

  if (!onClose) {
    return (
      <aside className="hidden lg:flex flex-col h-full w-80 bg-bg-1/80 dark:bg-[#050505] border-l border-border backdrop-blur-xl">
        {sidebarContent}
      </aside>
    )
  }

  return (
    <>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 dark:bg-black/80 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <motion.aside
        initial={{ x: '100%' }}
        animate={{ x: isOpen ? 0 : '100%' }}
        transition={{ type: 'spring', stiffness: 300, damping: 32 }}
        className="fixed top-0 right-0 h-full w-80 bg-bg/95 dark:bg-[#050505] border-l border-border z-50 lg:hidden backdrop-blur-xl"
      >
        {sidebarContent}
      </motion.aside>
    </>
  )
}
