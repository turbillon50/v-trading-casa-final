'use client'

import { motion } from 'framer-motion'
import { X, TrendingUp, TrendingDown } from 'lucide-react'
import { Area, AreaChart, ResponsiveContainer, Tooltip } from 'recharts'

interface LiveSidebarProps {
  isOpen?: boolean
  onClose?: () => void
}

// Mock data for equity curve with realistic variance (deterministic for SSR)
const mockEquityData = Array.from({ length: 50 }, (_, i) => {
  const baseValue = 42
  const trend = i * 0.08
  const volatility = Math.sin(i * 0.4) * 2.5 + Math.cos(i * 0.7) * 1.5
  const noise = Math.sin(i * 7.3) * 0.6
  return {
    time: i,
    value: baseValue + trend + volatility + noise,
  }
})

// Mock positions
const mockPositions = [
  { symbol: 'BTCUSDT', side: 'long', leverage: '10x', pnl: 2.34, pnlPercent: 5.2 },
  { symbol: 'ETHUSDT', side: 'short', leverage: '5x', pnl: -0.87, pnlPercent: -1.8 },
]

function EquityCurveCard() {
  const currentEquity = mockEquityData[mockEquityData.length - 1].value
  const previousEquity = mockEquityData[0].value
  const change = ((currentEquity - previousEquity) / previousEquity) * 100
  const isPositive = change >= 0

  return (
    <div className="relative rounded-2xl overflow-hidden bg-bg-1 dark:bg-[#080808] border border-border">
      {/* Ambient glow from chart */}
      <div 
        className="absolute inset-0 opacity-30 dark:opacity-40 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at 50% 80%, var(--amber-soft) 0%, transparent 60%)',
        }}
      />
      
      <div className="relative p-5">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-fg-3">Equity</span>
          <span className={`text-[12px] font-mono tabular-nums ${isPositive ? 'text-success' : 'text-error'}`}>
            {isPositive ? '+' : ''}{change.toFixed(2)}%
          </span>
        </div>
        <div className="text-[28px] font-semibold font-mono tabular-nums text-fg tracking-[-0.02em] mb-4">
          ${currentEquity.toFixed(2)}
        </div>
        <div className="h-36 -mx-2 -mb-2 min-w-[200px]" style={{ minHeight: 144 }}>
          <ResponsiveContainer width="100%" height={144}>
            <AreaChart data={mockEquityData}>
              <defs>
                <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--amber)" stopOpacity={0.5} />
                  <stop offset="50%" stopColor="var(--amber)" stopOpacity={0.15} />
                  <stop offset="100%" stopColor="var(--amber)" stopOpacity={0} />
                </linearGradient>
                <filter id="glow">
                  <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                  <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
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
      </div>
    </div>
  )
}

function BalanceWidget() {
  return (
    <div className="relative rounded-2xl overflow-hidden bg-bg-1 dark:bg-[#080808] border border-border">
      <div className="relative p-5 space-y-4">
        <div className="flex justify-between items-center">
          <span className="text-[13px] text-fg-2">Disponible</span>
          <span className="font-mono tabular-nums text-fg text-[15px]">$42.30</span>
        </div>
        <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />
        <div className="flex justify-between items-center">
          <span className="text-[13px] text-fg-2">PnL no realizado</span>
          <span className="font-mono tabular-nums text-success text-[15px]">+$1.47</span>
        </div>
      </div>
    </div>
  )
}

function PositionsMini() {
  return (
    <div className="relative rounded-2xl overflow-hidden bg-bg-1 dark:bg-[#080808] border border-border">
      <div className="relative p-5">
        <div className="flex items-center justify-between mb-4">
          <span className="text-[13px] text-fg-2">Posiciones</span>
          <span className="text-[11px] font-mono bg-bg-2 px-2.5 py-1 rounded-full text-fg-1 border border-border">
            {mockPositions.length}
          </span>
        </div>
        <div className="space-y-3">
          {mockPositions.map((pos) => (
            <div key={pos.symbol} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`w-1 h-6 rounded-full ${
                    pos.side === 'long' 
                      ? 'bg-gradient-to-b from-success to-success/70' 
                      : 'bg-gradient-to-b from-error to-error/70'
                  }`}
                  style={{
                    boxShadow: pos.side === 'long' 
                      ? '0 0 8px var(--success-soft)' 
                      : '0 0 8px var(--error-soft)',
                  }}
                />
                <div className="flex flex-col">
                  <span className="text-[13px] font-mono text-fg">{pos.symbol}</span>
                  <span className="text-[10px] text-fg-3 font-mono">{pos.leverage}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {pos.pnl >= 0 ? (
                  <TrendingUp className="w-3.5 h-3.5 text-success" />
                ) : (
                  <TrendingDown className="w-3.5 h-3.5 text-error" />
                )}
                <span
                  className={`text-[13px] font-mono tabular-nums ${
                    pos.pnl >= 0 ? 'text-success' : 'text-error'
                  }`}
                >
                  {pos.pnl >= 0 ? '+' : ''}${Math.abs(pos.pnl).toFixed(2)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function LiveSidebar({ isOpen = true, onClose }: LiveSidebarProps) {
  const sidebarContent = (
    <div className="flex flex-col h-full p-5 overflow-y-auto custom-scrollbar">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-amber animate-pulse" 
               style={{ boxShadow: '0 0 8px var(--amber-glow)' }} />
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

      {/* Cards */}
      <div className="space-y-4 flex-1">
        <EquityCurveCard />
        <BalanceWidget />
        <PositionsMini />
      </div>

      {/* Footer */}
      <div className="mt-6 pt-4 border-t border-border">
        <span className="text-[10px] font-mono text-fg-3 tracking-wide">
          Datos en vivo · refresh 5-15s
        </span>
      </div>
    </div>
  )

  // Desktop sidebar
  if (!onClose) {
    return (
      <aside className="hidden lg:flex flex-col h-full w-80 bg-bg-1/80 dark:bg-[#050505] border-l border-border backdrop-blur-xl">
        {sidebarContent}
      </aside>
    )
  }

  // Mobile drawer
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
