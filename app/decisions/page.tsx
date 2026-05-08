'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Menu, LineChart, ChevronDown, Check, X, Clock } from 'lucide-react'
import { LeftSidebar } from '@/components/left-sidebar'
import { LiveSidebar } from '@/components/live-sidebar'
import { LiveStatusBar } from '@/components/live-status-bar'
import { api, type TanitDecision } from '@/lib/api'
import { useEffect } from 'react'

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

function decisionFromBackend(t: TanitDecision): Decision {
  let type: Decision['type']
  if (t.decision_type === 'open_long' || t.decision_type === 'open_short') type = 'entry'
  else if (t.decision_type === 'close_position') type = 'exit'
  else if (t.decision_type === 'set_stops' || t.decision_type === 'cancel_all') type = 'adjust'
  else type = 'skip'

  let outcome: Decision['outcome']
  if (t.verdict === 'executed') outcome = 'success'
  else if (t.verdict === 'blocked' || t.verdict === 'rejected') outcome = 'failure'
  else outcome = 'pending'

  const thesis = t.thesis ?? ''
  const summary = thesis.split('\n')[0]?.slice(0, 120) || `${t.decision_type} · ${t.verdict}`
  const reasoning =
    thesis ||
    (t.execution_error ? `Error: ${t.execution_error}` : 'Sin justificación registrada.')

  // PnL si la decisión fue close_position con closedPnl en context
  let pnl: number | undefined
  if (typeof t.context === 'object' && t.context !== null) {
    const ctx = t.context as Record<string, unknown>
    const possible = ctx.closedPnl ?? ctx.pnl
    if (typeof possible === 'number') pnl = possible
    else if (typeof possible === 'string') {
      const n = parseFloat(possible)
      if (!isNaN(n)) pnl = n
    }
  }

  return {
    id: String(t.id),
    timestamp: new Date(t.created_at),
    type,
    symbol: t.symbol ?? '—',
    summary,
    reasoning,
    outcome,
    pnl,
  }
}

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
  const [decisions, setDecisions] = useState<Decision[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    async function load() {
      try {
        const r = await api.decisions(50)
        if (!mounted) return
        setDecisions((r.decisions ?? []).map(decisionFromBackend))
        setError(null)
      } catch (e) {
        if (mounted) setError(e instanceof Error ? e.message : 'sin conexión')
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
              <div className="flex items-baseline justify-between mb-6">
                <h1 className="text-2xl font-semibold text-fg tracking-tight-custom">
                  Decisiones
                </h1>
                <span className="text-[11px] font-mono text-fg-3">
                  {loading ? 'cargando…' : `${decisions.length} registros`}
                </span>
              </div>
              {error && (
                <div className="text-[12px] text-error/80 font-mono mb-4">
                  no conectado al backend: {error}
                </div>
              )}
              <div className="space-y-3">
                {decisions.length === 0 && !loading && !error && (
                  <div className="text-fg-2 text-sm py-8 text-center">
                    Sin decisiones registradas todavía. Tanit las irá generando aquí cuando opere.
                  </div>
                )}
                {decisions.map((decision) => (
                  <DecisionCard key={decision.id} decision={decision} />
                ))}
              </div>
            </div>
          </div>
        </main>

        <LiveSidebar />
      </div>

      <LiveStatusBar />

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
