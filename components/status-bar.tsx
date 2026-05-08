'use client'

import { motion } from 'framer-motion'
import { Circle, Database, Brain, BarChart3, Shield } from 'lucide-react'

interface StatusBarProps {
  tanitOnline?: boolean
  bybitLive?: boolean
  memoryCount?: number
  chatCount?: number
  positionsCount?: number
  pnl?: number
  haltActive?: boolean
}

function StatusPill({
  icon: Icon,
  label,
  value,
  status,
  color,
}: {
  icon?: React.ElementType
  label: string
  value?: string | number
  status?: 'online' | 'offline' | 'warning'
  color?: 'success' | 'error' | 'amber' | 'default'
}) {
  const statusColors = {
    online: 'bg-success',
    offline: 'bg-fg-3',
    warning: 'bg-amber',
  }

  const textColors = {
    success: 'text-success',
    error: 'text-error',
    amber: 'text-amber',
    default: 'text-fg-1',
  }

  return (
    <div 
      className="flex items-center gap-2 px-3 py-1.5 rounded-full whitespace-nowrap"
      style={{
        background: 'var(--glass-bg)',
        border: '1px solid var(--glass-border-subtle)',
      }}
    >
      {Icon && <Icon className="w-3 h-3 text-fg-3" strokeWidth={1.5} />}
      <span className="text-[10px] font-medium text-fg-2 uppercase tracking-wide">{label}</span>
      {status && (
        <motion.div
          className={`w-1.5 h-1.5 rounded-full ${statusColors[status]}`}
          animate={status === 'online' ? { opacity: [1, 0.4, 1] } : {}}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}
      {value !== undefined && (
        <span className={`text-[10px] font-mono tabular-nums ${textColors[color || 'default']}`}>
          {value}
        </span>
      )}
    </div>
  )
}

export function StatusBar({
  tanitOnline = true,
  bybitLive = true,
  memoryCount = 76,
  chatCount = 3809,
  positionsCount = 2,
  pnl = 1.47,
  haltActive = false,
}: StatusBarProps) {
  const formattedPnl = pnl >= 0 ? `+$${pnl.toFixed(2)}` : `-$${Math.abs(pnl).toFixed(2)}`
  const pnlColor = pnl >= 0 ? 'success' : 'error'

  return (
    <div 
      className="h-11 lg:h-12 flex items-center px-4 lg:px-5 relative z-20 border-t border-glass-border-subtle"
      style={{
        background: 'linear-gradient(180deg, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.9) 100%)',
        backdropFilter: 'blur(40px)',
        WebkitBackdropFilter: 'blur(40px)',
      }}
    >
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
        <StatusPill
          icon={Circle}
          label="Tanit"
          status={tanitOnline ? 'online' : 'offline'}
        />
        <StatusPill
          icon={Database}
          label="Bybit"
          status={bybitLive ? 'online' : 'offline'}
        />
        <StatusPill
          icon={Brain}
          label="Memoria"
          value={`${memoryCount} · ${chatCount}`}
        />
        <StatusPill
          icon={BarChart3}
          label="Pos"
          value={positionsCount}
        />
        <StatusPill
          label="PnL"
          value={formattedPnl}
          color={pnlColor}
        />
        {haltActive && (
          <motion.div
            className="flex items-center gap-2 px-3 py-1.5 rounded-full whitespace-nowrap"
            style={{
              background: 'var(--error-soft)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
            }}
            animate={{ opacity: [1, 0.6, 1] }}
            transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
          >
            <Shield className="w-3 h-3 text-error" strokeWidth={1.5} />
            <span className="text-[10px] font-semibold text-error uppercase tracking-wide">HALT</span>
          </motion.div>
        )}
      </div>
    </div>
  )
}
