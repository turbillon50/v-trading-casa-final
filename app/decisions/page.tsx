'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Menu, LineChart, ChevronDown, Check, X, Clock } from 'lucide-react'
import { LeftSidebar } from '@/components/left-sidebar'
import { LiveSidebar } from '@/components/live-sidebar'
import { LiveStatusBar } from '@/components/live-status-bar'
import { api, type TanitDecision } from '@/lib/api'
import { useEffect } from 'react'
import { usePaper, type PaperTrade, type PaperMetrics, type ThesisMetrics } from '@/hooks/use-paper'

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
    (t.execution_error ? `Error: ${t.execution_error}` : 'Sin justificacion registrada.')

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
    exit: 'bg-rose-soft text-rose',
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

function money(n: number | null | undefined, dp = 2): string {
  if (n == null || !isFinite(n)) return '—'
  return `${n >= 0 ? '+' : ''}$${n.toFixed(dp)}`
}

function MetricCell({ label, value, tone = 'neutral', sub }: {
  label: string
  value: string
  tone?: 'pos' | 'neg' | 'neutral' | 'warn'
  sub?: string
}) {
  const color =
    tone === 'pos' ? 'text-success' : tone === 'neg' ? 'text-error' : tone === 'warn' ? 'text-rose' : 'text-fg'
  return (
    <div className="glass rounded-lg p-3">
      <div className="text-[10px] uppercase tracking-wide text-fg-3 mb-1">{label}</div>
      <div className={`text-lg font-mono tabular-nums ${color}`}>{value}</div>
      {sub && <div className="text-[10px] text-fg-3 mt-0.5">{sub}</div>}
    </div>
  )
}

function PaperMetricsGrid({ m }: { m: PaperMetrics }) {
  const feeBite = m.fee_bite_ratio == null ? '—' : `${(m.fee_bite_ratio * 100).toFixed(0)}%`
  return (
    <div className="space-y-3 mb-4">
      {/* Global metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
        <MetricCell label="Win rate" value={`${(m.win_rate * 100).toFixed(0)}%`} sub={`${m.wins}W · ${m.losses}L`} />
        <MetricCell label="PnL neto" value={money(m.net_total)} tone={m.net_total >= 0 ? 'pos' : 'neg'} sub={`${m.cerradas} cerradas`} />
        <MetricCell label="Expectativa/op" value={money(m.expectativa_por_op, 3)} tone={m.expectativa_por_op >= 0 ? 'pos' : 'neg'} />
        <MetricCell label="Comisiones" value={money(-m.fees_total)} tone="warn" sub="mordida total" />
        <MetricCell label="Comision/bruto" value={feeBite} tone="warn" sub="mato al sistema previo" />
        <MetricCell label="Abiertas" value={String(m.abiertas)} sub={`${money(m.unrealized_abierto)} s/realizar`} />
      </div>

      {/* Per-thesis comparison */}
      {m.por_tesis && m.por_tesis.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-wide text-fg-3 mb-2">Comparacion por tesis</div>
          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${m.por_tesis.length}, 1fr)` }}>
            {m.por_tesis.map((th) => (
              <div key={th.version} className="glass rounded-lg p-3 space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono font-bold text-rose">{th.version}</span>
                  <span className="text-[10px] text-fg-3">{th.cerradas} cerr · {th.abiertas} abiert</span>
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px] font-mono">
                  <span className="text-fg-3">Win rate</span>
                  <span className={th.win_rate >= 0.5 ? 'text-success' : 'text-error'}>{(th.win_rate * 100).toFixed(0)}%</span>
                  <span className="text-fg-3">PnL neto</span>
                  <span className={th.net_total >= 0 ? 'text-success' : 'text-error'}>{money(th.net_total)}</span>
                  <span className="text-fg-3">Expectativa</span>
                  <span className={th.expectativa_por_op >= 0 ? 'text-success' : 'text-error'}>{money(th.expectativa_por_op, 3)}</span>
                  <span className="text-fg-3">Fee bite</span>
                  <span className="text-rose">{th.fee_bite_ratio != null ? `${(th.fee_bite_ratio * 100).toFixed(0)}%` : '—'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function PaperTradeCard({ t }: { t: PaperTrade }) {
  const [open, setOpen] = useState(false)
  const isOpen = t.outcome === 'open'
  const pnl = isOpen ? t.unrealized_pnl : t.net_pnl
  const sideColor = t.side === 'long' ? 'bg-success/20 text-success' : 'bg-rose-soft text-rose'
  const outcomeColor =
    t.outcome === 'win' ? 'text-success' : t.outcome === 'loss' ? 'text-error' : 'text-fg-2'

  const trailMoved = t.trailing_sl != null && t.stop_loss != null && t.trailing_sl !== t.stop_loss

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-xl overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full p-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <span className={`text-xs font-medium px-2 py-1 rounded-md uppercase ${sideColor}`}>{t.side}</span>
          <span className="font-mono text-sm text-fg">{t.symbol}</span>
          {t.thesis_version && (
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-rose/10 text-rose/70">{t.thesis_version}</span>
          )}
          <span className={`text-[11px] font-mono ${outcomeColor}`}>
            {isOpen ? 'abierta' : t.outcome}{t.motivo_cierre ? ` · ${t.motivo_cierre}` : ''}
          </span>
          {trailMoved && isOpen && (
            <span className="text-[10px] font-mono text-fg-3">trail</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className={`font-mono text-sm tabular-nums ${(pnl ?? 0) >= 0 ? 'text-success' : 'text-error'}`}>
            {money(pnl)}
          </span>
          <motion.div animate={{ rotate: open ? 180 : 0 }}>
            <ChevronDown className="w-4 h-4 text-fg-3" />
          </motion.div>
        </div>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
            transition={{ type: 'spring', stiffness: 280, damping: 30 }} className="overflow-hidden">
            <div className="px-4 pb-4 space-y-3 border-t border-glass-border pt-3">
              <p className="text-sm text-fg-1 leading-relaxed">
                <span className="text-fg-3 text-[11px] uppercase tracking-wide">Tesis · </span>
                {t.thesis}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 text-[11px] font-mono text-fg-2">
                <span>Entrada: {t.entry_price}</span>
                <span>{isOpen ? `Mark: ${t.last_mark_price ?? '—'}` : `Salida: ${t.exit_price ?? '—'}`}</span>
                <span>Tamano: ${t.size.toFixed(2)}</span>
                <span>Apal.: {t.leverage}x</span>
                <span>SL orig: {t.stop_loss ?? '—'}</span>
                <span>SL trail: {t.trailing_sl ?? '—'}</span>
                <span>TP: {t.take_profit ?? '—'}</span>
                <span>Mejor px: {t.best_price ?? '—'}</span>
                {!isOpen && <span>Bruto: {money(t.gross_pnl)}</span>}
                {!isOpen && <span>Comision: {money(t.fee_estimada != null ? -t.fee_estimada : null)}</span>}
                {t.funding_cost != null && t.funding_cost > 0 && (
                  <span className="text-rose">Funding: {money(-t.funding_cost)}</span>
                )}
              </div>
              <span className="text-[10px] font-mono text-fg-3">
                {new Date(t.opened_at).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                {' · '}{t.agente_version}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function PaperSection() {
  const { trades, metrics, online, loading } = usePaper()
  const open = trades.filter((t) => t.outcome === 'open')
  const closed = trades.filter((t) => t.outcome !== 'open')

  return (
    <section className="mb-8">
      <div className="flex items-baseline justify-between mb-3">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-fg tracking-tight-custom">Modo papel</h2>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-rose-soft text-rose uppercase">sin dinero real</span>
        </div>
        <span className="text-[11px] font-mono text-fg-3">
          {loading ? 'cargando...' : online ? `${open.length} abiertas · ${closed.length} cerradas` : 'feed offline'}
        </span>
      </div>

      {metrics && <PaperMetricsGrid m={metrics} />}

      <p className="text-[11.5px] text-fg-3 leading-relaxed mb-3">
        Trailing escalonado: BE a +0.5R, SL avanza a +1R y +2R, cierre a +3R. Slippage simulado 1.5bps/lado.
        Comisiones reales Bybit incluidas (taker 0.055%). La mordida de comisiones esta siempre a la vista —
        fue lo que mato al sistema anterior en 1,666 operaciones.
      </p>

      {open.length > 0 && (
        <div className="mb-4">
          <div className="text-[10px] uppercase tracking-wide text-fg-3 mb-2">Abiertas ahora</div>
          <div className="space-y-2">
            {open.map((t) => <PaperTradeCard key={t.id} t={t} />)}
          </div>
        </div>
      )}

      {closed.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-wide text-fg-3 mb-2">Historico</div>
          <div className="space-y-2">
            {closed.map((t) => <PaperTradeCard key={t.id} t={t} />)}
          </div>
        </div>
      )}

      {trades.length === 0 && !loading && (
        <div className="text-fg-2 text-sm py-6 text-center">
          {online ? 'El escaner abrira operaciones aqui cuando detecte setups con tesis.' : 'Feed de papel offline.'}
        </div>
      )}
    </section>
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
        if (mounted) setError(e instanceof Error ? e.message : 'sin conexion')
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
          className="w-10 h-10 rounded-lg glass border border-rose/30 flex items-center justify-center"
          aria-label="Abrir panel en vivo"
        >
          <LineChart className="w-5 h-5 text-rose" />
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
              <PaperSection />

              <div className="flex items-baseline justify-between mb-6">
                <h1 className="text-xl font-semibold text-fg tracking-tight-custom">
                  Decisiones del motor
                </h1>
                <span className="text-[11px] font-mono text-fg-3">
                  {loading ? 'cargando...' : `${decisions.length} registros`}
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
                    Sin decisiones registradas todavia. V-TRADING las ira generando aqui cuando opere.
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
