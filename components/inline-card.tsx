'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, Wallet, TrendingUp, DollarSign, BarChart3 } from 'lucide-react'
import { useState, useEffect } from 'react'

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
    { label: 'PnL', value: data.pnl as number, prefix: (data.pnl as number) >= 0 ? '+$' : '-$', isColored: true },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 mt-4">
      {items.map((item) => (
        <div 
          key={item.label} 
          className="rounded-xl p-4 relative overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, var(--bg-2) 0%, var(--bg-3) 100%)',
            border: '1px solid var(--glass-border-subtle)',
          }}
        >
          {/* Subtle glow for PnL */}
          {item.isColored && (item.value as number) >= 0 && (
            <div 
              className="absolute inset-0 opacity-20"
              style={{
                background: 'radial-gradient(circle at bottom right, var(--success-soft) 0%, transparent 70%)',
              }}
            />
          )}
          <span className="text-[10px] uppercase tracking-wide text-fg-3 block mb-2">
            {item.label}
          </span>
          <span
            className={`font-mono tabular-nums text-base font-medium relative z-10 ${
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
    <div className="mt-4 space-y-2">
      {positions?.map((pos, i) => (
        <div 
          key={i} 
          className="flex items-center justify-between rounded-xl p-4"
          style={{
            background: 'linear-gradient(135deg, var(--bg-2) 0%, var(--bg-3) 100%)',
            border: '1px solid var(--glass-border-subtle)',
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-1 h-7 rounded-full ${
                pos.side === 'long' ? 'bg-success' : 'bg-error'
              }`}
            />
            <div>
              <span className="font-mono text-sm text-fg">{pos.symbol}</span>
              <span className="text-[10px] text-fg-3 ml-2 uppercase">{pos.leverage}</span>
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
  const [formattedTime, setFormattedTime] = useState<string>('--:--:--')
  const Icon = iconMap[type]
  const title = titleMap[type]

  // Format time only on client to avoid hydration mismatch
  useEffect(() => {
    const ts = timestamp ? new Date(timestamp) : new Date()
    setFormattedTime(ts.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
  }, [timestamp])

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 28 }}
      className="rounded-2xl p-5 mt-3"
      style={{
        background: 'var(--glass-bg)',
        backdropFilter: 'blur(40px)',
        WebkitBackdropFilter: 'blur(40px)',
        border: '1px solid var(--glass-border)',
      }}
    >
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between gap-4"
      >
        <div className="flex items-center gap-4">
          <div 
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{
              background: 'var(--amber-soft)',
              border: '1px solid rgba(245, 166, 35, 0.15)',
            }}
          >
            <Icon className="w-5 h-5 text-amber" strokeWidth={1.5} />
          </div>
          <div className="text-left">
            <span className="text-xs text-fg-2 block mb-0.5">{title}</span>
            <span className="text-[14px] text-fg">{summary}</span>
          </div>
        </div>
        <motion.div
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="p-2 rounded-lg hover:bg-glass-bg transition-colors"
        >
          <ChevronDown className="w-4 h-4 text-fg-3" strokeWidth={1.5} />
        </motion.div>
      </button>

      {/* Expandable content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="overflow-hidden"
          >
            {type === 'balance' && <BalanceContent data={data} />}
            {type === 'positions' && <PositionsContent data={data} />}
            {type === 'price' && (
              <div className="mt-4">
                <pre 
                  className="rounded-xl p-4 text-xs font-mono overflow-x-auto text-fg-1"
                  style={{
                    background: 'var(--bg-3)',
                    border: '1px solid var(--glass-border-subtle)',
                  }}
                >
                  {JSON.stringify(data, null, 2)}
                </pre>
              </div>
            )}
            {type === 'decision' && (
              <div className="mt-4">
                <pre 
                  className="rounded-xl p-4 text-xs font-mono text-fg-1 overflow-x-auto"
                  style={{
                    background: 'var(--bg-3)',
                    border: '1px solid var(--glass-border-subtle)',
                  }}
                >
                  {JSON.stringify(data, null, 2)}
                </pre>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <div className="mt-4 pt-3 border-t border-glass-border-subtle">
        <span className="text-[10px] font-mono text-fg-3/60">
          fuente: Bybit · {formattedTime}
        </span>
      </div>
    </motion.div>
  )
}
