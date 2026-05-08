'use client'

import { motion } from 'framer-motion'
import { X, TrendingUp, TrendingDown } from 'lucide-react'
import { Area, AreaChart, ResponsiveContainer, Tooltip } from 'recharts'

interface LiveSidebarProps {
  isOpen?: boolean
  onClose?: () => void
}

// Mock data for equity curve
const mockEquityData = Array.from({ length: 50 }, (_, i) => ({
  time: i,
  value: 45 + Math.sin(i * 0.3) * 3 + Math.random() * 2 + i * 0.05,
}))

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
    <div className="glass rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-mono uppercase tracking-wider text-fg-2">Equity</span>
        <span className={`text-xs font-mono tabular-nums ${isPositive ? 'text-success' : 'text-error'}`}>
          {isPositive ? '+' : ''}{change.toFixed(2)}%
        </span>
      </div>
      <div className="text-2xl font-semibold font-mono tabular-nums text-fg mb-3">
        ${currentEquity.toFixed(2)}
      </div>
      <div className="h-32 -mx-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={mockEquityData}>
            <defs>
              <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#F59E0B" stopOpacity={0.45} />
                <stop offset="100%" stopColor="#F59E0B" stopOpacity={0} />
              </linearGradient>
            </defs>
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="glass rounded-lg px-2 py-1">
                      <span className="text-[11px] font-mono text-fg">
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
              stroke="#F59E0B"
              strokeWidth={1.5}
              fill="url(#equityGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function BalanceWidget() {
  return (
    <div className="glass rounded-xl p-4 space-y-3">
      <div className="flex justify-between items-center">
        <span className="text-xs text-fg-2">Disponible</span>
        <span className="font-mono tabular-nums text-fg">$42.30</span>
      </div>
      <div className="flex justify-between items-center">
        <span className="text-xs text-fg-2">PnL no realizado</span>
        <span className="font-mono tabular-nums text-success">+$1.47</span>
      </div>
    </div>
  )
}

function PositionsMini() {
  return (
    <div className="glass rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-fg-2">Posiciones</span>
        <span className="text-[10px] font-mono bg-bg-elev px-2 py-0.5 rounded-full text-fg-1">
          {mockPositions.length}
        </span>
      </div>
      <div className="space-y-2">
        {mockPositions.map((pos) => (
          <div key={pos.symbol} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className={`w-1 h-5 rounded-full ${
                  pos.side === 'long' ? 'bg-success' : 'bg-error'
                }`}
              />
              <span className="text-xs font-mono text-fg">{pos.symbol}</span>
              <span className="text-[10px] text-fg-3">{pos.leverage}</span>
            </div>
            <div className="flex items-center gap-1">
              {pos.pnl >= 0 ? (
                <TrendingUp className="w-3 h-3 text-success" />
              ) : (
                <TrendingDown className="w-3 h-3 text-error" />
              )}
              <span
                className={`text-xs font-mono tabular-nums ${
                  pos.pnl >= 0 ? 'text-success' : 'text-error'
                }`}
              >
                {pos.pnl >= 0 ? '+' : ''}${pos.pnl.toFixed(2)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function LiveSidebar({ isOpen = true, onClose }: LiveSidebarProps) {
  const sidebarContent = (
    <div className="flex flex-col h-full p-4 overflow-y-auto custom-scrollbar">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-[11px] font-mono uppercase tracking-wider text-fg-2">
          Live · V Trading
        </span>
        {onClose && (
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-bg-elev transition-colors lg:hidden"
            aria-label="Cerrar panel"
          >
            <X className="w-4 h-4 text-fg-2" />
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
      <div className="mt-4 pt-3 border-t border-glass-border">
        <span className="text-[10px] font-mono text-fg-3">
          Datos en vivo · refresh 5-15s
        </span>
      </div>
    </div>
  )

  // Desktop sidebar
  if (!onClose) {
    return (
      <aside className="hidden lg:flex flex-col h-full w-80 glass border-l border-glass-border">
        {sidebarContent}
      </aside>
    )
  }

  // Mobile drawer
  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Drawer */}
      <motion.aside
        initial={{ x: '100%' }}
        animate={{ x: isOpen ? 0 : '100%' }}
        transition={{ type: 'spring', stiffness: 280, damping: 30 }}
        className="fixed top-0 right-0 h-full w-80 glass border-l border-glass-border z-50 lg:hidden"
      >
        {sidebarContent}
      </motion.aside>
    </>
  )
}
