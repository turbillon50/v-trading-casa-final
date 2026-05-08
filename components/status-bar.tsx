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
    <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-bg-2 whitespace-nowrap">
      {Icon && <Icon className="w-3 h-3 text-fg-3" />}
      <span className="text-[10px] font-medium text-fg-2">{label}</span>
      {status && (
        <motion.div
          className={`w-1.5 h-1.5 rounded-full ${statusColors[status]}`}
          animate={status === 'online' ? { opacity: [1, 0.5, 1] } : {}}
          transition={{ duration: 2, repeat: Infinity }}
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
    <div className="h-10 lg:h-12 glass border-t border-glass-border flex items-center px-3 lg:px-4">
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
          value={`${memoryCount} · ${chatCount} chats`}
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
            className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-error/20 whitespace-nowrap"
            animate={{ opacity: [1, 0.6, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
          >
            <Shield className="w-3 h-3 text-error" />
            <span className="text-[10px] font-medium text-error">HALT</span>
          </motion.div>
        )}
      </div>
    </div>
  )
}
