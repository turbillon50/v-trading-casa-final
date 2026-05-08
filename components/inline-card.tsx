'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, Wallet, TrendingUp, DollarSign, BarChart3 } from 'lucide-react'
import { useState } from 'react'

type CardType = 'balance' | 'positions' | 'price' | 'decision'

interface InlineCardProps {
  type: CardType
  summary: string
  data: Record<string, unknown>
  timestamp?: string
}

const iconMap = {
  balance: Wallet,
  positions: TrendingUp,
  price: BarChart3,
  decision: DollarSign,
}

const titleMap = {
  balance: 'Balance',
  positions: 'Posiciones',
  price: 'Precio de Mercado',
  decision: 'Decision',
}

function BalanceContent({ data }: { data: Record<string, unknown> }) {
  const items = [
    { label: 'Equity', value: data.equity as number, prefix: '$' },
    { label: 'Disponible', value: data.available as number, prefix: '$' },
    { label: 'Total', value: data.total as number, prefix: '$' },
    { label: 'PnL', value: data.pnl as number, prefix: data.pnl as number >= 0 ? '+$' : '-$', isColored: true },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 mt-3">
      {items.map((item) => (
        <div key={item.label} className="bg-bg-3 rounded-lg p-3">
          <span className="text-[10px] uppercase tracking-wider text-fg-3 block mb-1">
            {item.label}
          </span>
          <span
            className={`font-mono tabular-nums text-sm ${
              item.isColored
                ? (item.value as number) >= 0
                  ? 'text-success'
                  : 'text-error'
                : 'text-fg'
            }`}
          >
            {item.prefix}
            {Math.abs(item.value as number).toFixed(2)}
          </span>
        </div>
      ))}
    </div>
  )
}

function PositionsContent({ data }: { data: Record<string, unknown> }) {
  const positions = data.positions as Array<{
    symbol: string
    side: string
    leverage: string
    pnl: number
    size: number
  }>

  return (
    <div className="mt-3 space-y-2">
      {positions.map((pos, i) => (
        <div key={i} className="flex items-center justify-between bg-bg-3 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <div
              className={`w-1.5 h-6 rounded-full ${
                pos.side === 'long' ? 'bg-success' : 'bg-error'
              }`}
            />
            <div>
              <span className="font-mono text-sm text-fg">{pos.symbol}</span>
              <span className="text-[10px] text-fg-3 ml-2">{pos.leverage}</span>
            </div>
          </div>
          <div className="text-right">
            <span
              className={`font-mono tabular-nums text-sm block ${
                pos.pnl >= 0 ? 'text-success' : 'text-error'
              }`}
            >
              {pos.pnl >= 0 ? '+' : ''}${pos.pnl.toFixed(2)}
            </span>
            <span className="text-[10px] text-fg-3">{pos.size} USDT</span>
          </div>
        </div>
      ))}
    </div>
  )
}

export function InlineCard({ type, summary, data, timestamp }: InlineCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const Icon = iconMap[type]
  const title = titleMap[type]

  const formatTime = (ts?: string) => {
    if (!ts) return new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    return new Date(ts).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 280, damping: 30 }}
      className="glass rounded-xl p-4 mt-2"
    >
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between gap-3"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-soft flex items-center justify-center">
            <Icon className="w-4 h-4 text-amber" />
          </div>
          <div className="text-left">
            <span className="text-xs text-fg-2 block">{title}</span>
            <span className="text-sm text-fg">{summary}</span>
          </div>
        </div>
        <motion.div
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="w-4 h-4 text-fg-3" />
        </motion.div>
      </button>

      {/* Expandable content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 280, damping: 30 }}
            className="overflow-hidden"
          >
            {type === 'balance' && <BalanceContent data={data} />}
            {type === 'positions' && <PositionsContent data={data} />}
            {type === 'price' && (
              <div className="mt-3 text-sm text-fg-1">
                <pre className="bg-bg-3 rounded-lg p-3 text-xs font-mono overflow-x-auto">
                  {JSON.stringify(data, null, 2)}
                </pre>
              </div>
            )}
            {type === 'decision' && (
              <div className="mt-3">
                <pre className="bg-bg-3 rounded-lg p-3 text-xs font-mono text-fg-1 overflow-x-auto">
                  {JSON.stringify(data, null, 2)}
                </pre>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <div className="mt-3 pt-2 border-t border-glass-border">
        <span className="text-[10px] font-mono text-fg-3">
          fuente: Bybit · {formatTime(timestamp)}
        </span>
      </div>
    </motion.div>
  )
}
