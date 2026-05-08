'use client'

import { motion } from 'framer-motion'
import { X, TrendingUp, TrendingDown } from 'lucide-react'
import { Area, AreaChart, ResponsiveContainer, Tooltip } from 'recharts'
import { useEffect, useState } from 'react'
import { api, type PortfolioBalance, type PortfolioPosition, type BalanceSnapshot } from '@/lib/api'

interface LiveSidebarProps {
  isOpen?: boolean
  onClose?: () => void
}

// Cuando la API todavía no devuelve nada, mostramos una curva placeholder
// (suave, sin valores reales) para que el SSR no rompa.
const placeholderEquityData = Array.from({ length: 50 }, (_, i) => {
  const baseValue = 42
  const trend = i * 0.08
  const volatility = Math.sin(i * 0.4) * 2.5 + Math.cos(i * 0.7) * 1.5
  const noise = Math.sin(i * 7.3) * 0.6
  return { time: i, value: baseValue + trend + volatility + noise }
})

function EquityCurveCard() {
  const [snaps, setSnaps] = useState<BalanceSnapshot[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    async function load() {
      try {
        const r = await api.balanceSnapshots(200)
        if (!mounted) return
        setSnaps(r.snapshots ?? [])
        setError(null)
      } catch (e) {
        if (mounted) setError(e instanceof Error ? e.message : 'sin conexion')
      }
    }
    load()
    const id = setInterval(load, 15_000)
    return () => { mounted = false; clearInterval(id) }
  }, [])

  const equityData = snaps.length >= 2
    ? snaps
        .slice()
        .reverse()
        .map((s, i) => ({
          time: i,
          value: parseFloat(s.equity ?? s.balance ?? '0') || 0,
        }))
    : placeholderEquityData

  const currentEquity = equityData[equityData.length - 1]?.value ?? 0
  const previousEquity = equityData[0]?.value ?? 0
  const change = previousEquity > 0 ? ((currentEquity - previousEquity) / previousEquity) * 100 : 0
  const isPositive = change >= 0
  const showingReal = snaps.length >= 2

  return (
    <div className="relative rounded-2xl overflow-hidden bg-bg-1 dark:bg-[#080808] border border-border">
      <div
        className="absolute inset-0 opacity-30 dark:opacity-40 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at 50% 80%, var(--amber-soft) 0%, transparent 60%)',
        }}
      />

      <div className="relative p-5">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-fg-3">Equity</span>
          {showingReal ? (
            <span className={`text-[12px] font-mono tabular-nums ${isPositive ? 'text-success' : 'text-error'}`}>
              {isPositive ? '+' : ''}{change.toFixed(2)}%
            </span>
          ) : (
            <span className="text-[10px] font-mono text-fg-3">construyendo histórico…</span>
          )}
        </div>
        <div className="text-[28px] font-semibold font-mono tabular-nums text-fg tracking-[-0.02em] mb-4">
          {showingReal ? `$${currentEquity.toFixed(2)}` : '—'}
        </div>
        <div className="h-36 -mx-2 -mb-2 min-w-[200px]" style={{ minHeight: 144 }}>
          <ResponsiveContainer width="100%" height={144}>
            <AreaChart data={equityData}>
              <defs>
                <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--amber)" stopOpacity={0.5} />
                  <stop offset="50%" stopColor="var(--amber)" stopOpacity={0.15} />
                  <stop offset="100%" stopColor="var(--amber)" stopOpacity={0} />
                </linearGradient>
                <filter id="glow">
                  <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                  <feMerge>
                    <feMergeNode in="coloredBlur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="bg-bg-elev border border-border rounded-lg px-3 py-2 backdrop-blur-xl">
                        <span className="text-[12px] font-mono text-fg tabular-nums">
                          ${Number(payload[0].value).toFixed(2)}
                        </span>
                      </div>
                    )
                  }
                  return null
                }}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="var(--amber)"
                strokeWidth={2}
                fill="url(#equityGradient)"
                filter="url(#glow)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        {error && (
          <div className="text-[10px] text-error/60 font-mono mt-2">conexion: {error}</div>
        )}
      </div>
    </div>
  )
}

function BalanceWidget() {
  const [b, setB] = useState<PortfolioBalance | null>(null)

  useEffect(() => {
    let mounted = true
    async function load() {
      try {
        const data = await api.balance()
        if (mounted) setB(data)
      } catch {
        /* fallback to —, sin estado de error visible aquí */
      }
    }
    load()
    const id = setInterval(load, 10_000)
    return () => { mounted = false; clearInterval(id) }
  }, [])

  const available = b?.availableBalance ?? null
  const upnl = b?.unrealizedPnl ?? null

  return (
    <div className="relative rounded-2xl overflow-hidden bg-bg-1 dark:bg-[#080808] border border-border">
      <div className="relative p-5 space-y-4">
        <div className="flex justify-between items-center">
          <span className="text-[13px] text-fg-2">Disponible</span>
          <span className="font-mono tabular-nums text-fg text-[15px]">
            {available !== null ? `$${available.toFixed(2)}` : '—'}
          </span>
        </div>
        <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />
        <div className="flex justify-between items-center">
          <span className="text-[13px] text-fg-2">PnL no realizado</span>
          <span
            className={`font-mono tabular-nums text-[15px] ${
              upnl === null ? 'text-fg' : upnl >= 0 ? 'text-success' : 'text-error'
            }`}
          >
            {upnl !== null
              ? `${upnl >= 0 ? '+' : ''}$${upnl.toFixed(4)}`
              : '—'}
          </span>
        </div>
      </div>
    </div>
  )
}

function PositionsMini() {
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
        /* fallback empty */
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    const id = setInterval(load, 8_000)
    return () => { mounted = false; clearInterval(id) }
  }, [])

  return (
    <div className="relative rounded-2xl overflow-hidden bg-bg-1 dark:bg-[#080808] border border-border">
      <div className="relative p-5">
        <div className="flex items-center justify-between mb-4">
          <span className="text-[13px] text-fg-2">Posiciones</span>
          <span className="text-[11px] font-mono bg-bg-2 px-2.5 py-1 rounded-full text-fg-1 border border-border">
            {loading ? '…' : positions.length}
          </span>
        </div>

        {positions.length === 0 ? (
          <div className="text-[12px] text-fg-3 font-mono py-2">
            {loading ? 'cargando…' : 'sin posiciones abiertas'}
          </div>
        ) : (
          <div className="space-y-3">
            {positions.slice(0, 5).map((pos) => {
              const isLong = pos.side === 'Buy'
              const pnl = pos.unrealizedPnl ?? 0
              const symbolShort = pos.symbol.replace('USDT', 'USDT')
              return (
                <div key={pos.symbol} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-1 h-6 rounded-full ${
                        isLong
                          ? 'bg-gradient-to-b from-success to-success/70'
                          : 'bg-gradient-to-b from-error to-error/70'
                      }`}
                      style={{
                        boxShadow: isLong
                          ? '0 0 8px var(--success-soft)'
                          : '0 0 8px var(--error-soft)',
                      }}
                    />
                    <div className="flex flex-col">
                      <span className="text-[13px] font-mono text-fg">{symbolShort}</span>
                      <span className="text-[10px] text-fg-3 font-mono">
                        {Math.round(pos.leverage)}x
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {pnl >= 0 ? (
                      <TrendingUp className="w-3.5 h-3.5 text-success" />
                    ) : (
                      <TrendingDown className="w-3.5 h-3.5 text-error" />
                    )}
                    <span
                      className={`text-[13px] font-mono tabular-nums ${
                        pnl >= 0 ? 'text-success' : 'text-error'
                      }`}
                    >
                      {pnl >= 0 ? '+' : ''}${Math.abs(pnl).toFixed(2)}
                    </span>
                  </div>
                </div>
              )
            })}
            {positions.length > 5 && (
              <div className="text-[10px] text-fg-3 font-mono italic pt-1">
                +{positions.length - 5} más…
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export function LiveSidebar({ isOpen = true, onClose }: LiveSidebarProps) {
  const sidebarContent = (
    <div className="flex flex-col h-full p-5 overflow-y-auto custom-scrollbar">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <div
            className="w-1.5 h-1.5 rounded-full bg-amber animate-pulse"
            style={{ boxShadow: '0 0 8px var(--amber-glow)' }}
          />
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
        <EquityCurveCard />
        <BalanceWidget />
        <PositionsMini />
      </div>

      <div className="mt-6 pt-4 border-t border-border">
        <span className="text-[10px] font-mono text-fg-3 tracking-wide">
          Datos en vivo · refresh 5-15s
        </span>
      </div>
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
