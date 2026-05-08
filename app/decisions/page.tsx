'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Menu, LineChart, ChevronDown, Check, X, Clock } from 'lucide-react'
import { LeftSidebar } from '@/components/left-sidebar'
import { LiveSidebar } from '@/components/live-sidebar'
import { StatusBar } from '@/components/status-bar'

interface Decision {
  id: string
  timestamp: Date
  type: 'entry' | 'exit' | 'skip' | 'adjust'
  symbol: string
  summary: string
  reasoning: string
  outcome?: 'success' | 'failure' | 'pending'
  pnl?: number
}

const mockDecisions: Decision[] = [
  {
    id: '1',
    timestamp: new Date(Date.now() - 3600000 * 24),
    type: 'entry',
    symbol: 'BTCUSDT',
    summary: 'Long 5x en ruptura de resistencia',
    reasoning: 'El precio rompio $68,500 con volumen alto. RSI en 62, sin sobrecompra. Estructura alcista confirmada.',
    outcome: 'success',
    pnl: 2.34,
  },
  {
    id: '2',
    timestamp: new Date(Date.now() - 3600000 * 12),
    type: 'skip',
    symbol: 'ETHUSDT',
    summary: 'Evitar entrada en consolidacion',
    reasoning: 'ETH en rango estrecho sin direccion clara. Mejor esperar confirmacion de tendencia.',
    outcome: 'success',
  },
  {
    id: '3',
    timestamp: new Date(Date.now() - 3600000 * 2),
    type: 'entry',
    symbol: 'ETHUSDT',
    summary: 'Short 5x por divergencia bajista',
    reasoning: 'Divergencia en RSI 4H. Rechazo en resistencia $3,850. Target: $3,720.',
    outcome: 'pending',
  },
]

function DecisionCard({ decision }: { decision: Decision }) {
  const [isExpanded, setIsExpanded] = useState(false)

  const typeColors = {
    entry: 'bg-success/20 text-success',
    exit: 'bg-amber-soft text-amber',
    skip: 'bg-fg-3/20 text-fg-2',
    adjust: 'bg-blue-500/20 text-blue-400',
  }

  const outcomeIcons = {
    success: <Check className="w-4 h-4 text-success" />,
    failure: <X className="w-4 h-4 text-error" />,
    pending: <Clock className="w-4 h-4 text-fg-2" />,
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-xl overflow-hidden"
    >
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 flex items-center justify-between gap-4"
      >
        <div className="flex items-center gap-3">
          <span className={`text-xs font-medium px-2 py-1 rounded-md uppercase ${typeColors[decision.type]}`}>
            {decision.type}
          </span>
          <span className="font-mono text-sm text-fg">{decision.symbol}</span>
          {decision.outcome && outcomeIcons[decision.outcome]}
        </div>
        <div className="flex items-center gap-3">
          {decision.pnl !== undefined && (
            <span className={`font-mono text-sm tabular-nums ${decision.pnl >= 0 ? 'text-success' : 'text-error'}`}>
              {decision.pnl >= 0 ? '+' : ''}${decision.pnl.toFixed(2)}
            </span>
          )}
          <motion.div animate={{ rotate: isExpanded ? 180 : 0 }}>
            <ChevronDown className="w-4 h-4 text-fg-3" />
          </motion.div>
        </div>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            transition={{ type: 'spring', stiffness: 280, damping: 30 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3 border-t border-glass-border pt-3">
              <p className="text-sm text-fg font-medium">{decision.summary}</p>
              <p className="text-sm text-fg-1">{decision.reasoning}</p>
              <span className="text-[10px] font-mono text-fg-3">
                {decision.timestamp.toLocaleDateString('es-MX', {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export default function DecisionsPage() {
  const [leftDrawerOpen, setLeftDrawerOpen] = useState(false)
  const [rightDrawerOpen, setRightDrawerOpen] = useState(false)

  return (
    <div className="h-screen flex flex-col bg-bg overflow-hidden">
      {/* Mobile Header */}
      <div className="lg:hidden h-14 flex items-center justify-between px-4 border-b border-glass-border">
        <button
          onClick={() => setLeftDrawerOpen(true)}
          className="w-10 h-10 rounded-lg glass flex items-center justify-center"
          aria-label="Abrir menu"
        >
          <Menu className="w-5 h-5 text-fg" />
        </button>
        <span className="text-sm font-semibold text-fg tracking-tight-custom">Decisiones</span>
        <button
          onClick={() => setRightDrawerOpen(true)}
          className="w-10 h-10 rounded-lg glass border border-amber/30 flex items-center justify-center"
          aria-label="Abrir panel en vivo"
        >
          <LineChart className="w-5 h-5 text-amber" />
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        <LeftSidebar />
        <div className="hidden md:flex lg:hidden">
          <LeftSidebar collapsed />
        </div>

        <main className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 lg:p-6">
            <div className="max-w-3xl mx-auto">
              <h1 className="text-2xl font-semibold text-fg tracking-tight-custom mb-6">
                Decisiones
              </h1>
              <div className="space-y-3">
                {mockDecisions.map((decision) => (
                  <DecisionCard key={decision.id} decision={decision} />
                ))}
              </div>
            </div>
          </div>
        </main>

        <LiveSidebar />
      </div>

      <StatusBar />

      <AnimatePresence>
        {leftDrawerOpen && (
          <LeftSidebar isOpen={leftDrawerOpen} onClose={() => setLeftDrawerOpen(false)} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {rightDrawerOpen && (
          <LiveSidebar isOpen={rightDrawerOpen} onClose={() => setRightDrawerOpen(false)} />
        )}
      </AnimatePresence>
    </div>
  )
}
