'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ShieldCheck,
  Layers,
  Gauge as GaugeIcon,
  Activity,
  Power,
  Send,
  ArrowRight,
  AlertTriangle,
  LineChart as LineChartIcon,
} from 'lucide-react'
import { TanitOrb } from './tanit-orb'
import { MarketTicker } from './market-ticker'
import {
  Panel,
  StatusChip,
  OfflineNote,
  DataRow,
  Gauge,
  SegmentedBar,
  ConfidencePips,
} from './vt-primitives'
import { api } from '@/lib/api'

const QUICK_ACTIONS = ['Análisis de mercado', 'Revisar posiciones', 'Escenarios', 'Gestión de riesgo']
const TIMEFRAMES = ['1m', '5m', '15m', '1H', '4H', '1D', '1W']

/* ── hook: estado honesto de conectores ─────────────────────────────────── */
function useConnectors() {
  const [state, setState] = useState<{
    loading: boolean
    reachable: boolean
    markets: boolean
    engine: boolean // motor de ejecución — offline por diseño en esta build
    data: boolean
  }>({ loading: true, reachable: false, markets: false, engine: false, data: false })

  useEffect(() => {
    let mounted = true
    const tick = async () => {
      try {
        const r = await api.systemStatus()
        if (!mounted) return
        const find = (n: string) => r.components?.find((c) => c.name.toLowerCase().includes(n))
        setState({
          loading: false,
          reachable: true,
          markets: !!find('market')?.ok || !!find('bybit')?.ok,
          engine: false, // el motor está apagado por diseño; nunca lo reportamos "on" aquí
          data: !!find('data')?.ok || !!find('neon')?.ok,
        })
      } catch {
        if (!mounted) return
        setState({ loading: false, reachable: false, markets: false, engine: false, data: false })
      }
    }
    tick()
    const id = setInterval(tick, 30000)
    return () => {
      mounted = false
      clearInterval(id)
    }
  }, [])

  return state
}

export function CommandCenter() {
  const router = useRouter()
  const [greeting, setGreeting] = useState('Hola')
  const [tf, setTf] = useState('4H')
  const draftRef = useRef<HTMLInputElement>(null)
  const conn = useConnectors()

  useEffect(() => {
    const h = new Date().getHours()
    setGreeting(h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches')
  }, [])

  const go = (text?: string) => {
    if (text) {
      try {
        sessionStorage.setItem('vt-draft', text)
      } catch {}
    }
    router.push('/chat')
  }

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    go(draftRef.current?.value?.trim() || undefined)
  }

  return (
    <div className="vt-grid min-h-full">
      {/* Ticker móvil (el desktop lo lleva el header del shell) */}
      <div className="lg:hidden px-4 py-3 border-b border-border">
        <MarketTicker variant="bar" />
      </div>

      <div className="mx-auto w-full max-w-[1400px] px-4 lg:px-6 py-5 lg:py-6">
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_336px] gap-5">
          {/* ── Columna central ─────────────────────────────────────────── */}
          <div className="space-y-5 min-w-0">
            {/* Hero saludo + entrada de chat */}
            <motion.section
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="relative overflow-hidden rounded-xl border border-border bg-bg-1/70 p-6 lg:p-7"
            >
              <div className="relative z-10 max-w-[560px]">
                <h2 className="text-[30px] lg:text-[38px] font-semibold text-fg tracking-[-0.02em] leading-[1.05]">
                  {greeting}, Luis
                </h2>
                <p className="text-[13.5px] text-fg-2 mt-2.5 leading-relaxed max-w-[440px]">
                  V-TRADING está observando el mercado y preparada para ayudarte a tomar mejores decisiones.
                </p>

                <form onSubmit={onSubmit} className="mt-5">
                  <div className="flex items-center gap-2 rounded-xl border border-border bg-bg-2 focus-within:border-amber/50 transition-colors px-3.5 py-2.5">
                    <input
                      ref={draftRef}
                      type="text"
                      placeholder="Pregunta, analiza o pide una opinión sobre el mercado…"
                      className="flex-1 bg-transparent text-[13.5px] text-fg placeholder:text-fg-3 outline-none min-w-0"
                      aria-label="Habla con V-TRADING"
                    />
                    <button
                      type="submit"
                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-amber text-[color:var(--primary-foreground)] hover:bg-amber-warm transition-colors flex-shrink-0"
                      aria-label="Enviar a V-TRADING"
                    >
                      <Send className="w-4 h-4" strokeWidth={2} />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {QUICK_ACTIONS.map((a) => (
                      <button
                        key={a}
                        type="button"
                        onClick={() => go(a)}
                        className="text-[11.5px] text-fg-2 hover:text-fg border border-border hover:border-amber/40 rounded-full px-3 py-1.5 transition-colors"
                      >
                        {a}
                      </button>
                    ))}
                  </div>
                </form>
              </div>

              {/* Orbe dorado — irradia (iluminación localizada) */}
              <div className="hidden sm:block absolute right-4 lg:right-8 top-1/2 -translate-y-1/2 opacity-90 pointer-events-none">
                <TanitOrb state="idle" size="xl" />
              </div>
            </motion.section>

            {/* Tesis actual — honesta (motor de análisis offline) */}
            <Panel
              title="Tesis actual"
              icon={LineChartIcon}
              status={<StatusChip tone="offline" label="sin tesis vigente" />}
            >
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-4">
                <div className="min-w-0">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-fg-3 mb-1">Escenario principal</div>
                  <div className="text-[15px] font-medium text-fg-2">—</div>
                  <OfflineNote>
                    El motor de análisis está offline en esta build. Cuando esté activo, aquí aparece el escenario
                    vigente con su estructura de mercado. No mostramos tesis inventadas.
                  </OfflineNote>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-1 gap-3 sm:gap-2 sm:text-right sm:min-w-[130px]">
                  <div>
                    <div className="text-[10px] font-mono uppercase tracking-wider text-fg-3">Nivel clave</div>
                    <div className="text-[14px] font-mono nums text-fg-3">—</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-mono uppercase tracking-wider text-fg-3">Invalidación</div>
                    <div className="text-[14px] font-mono nums text-fg-3">—</div>
                  </div>
                  <div className="flex flex-col sm:items-end">
                    <div className="text-[10px] font-mono uppercase tracking-wider text-fg-3 mb-1">Confianza</div>
                    <ConfidencePips filled={0} offline />
                  </div>
                </div>
              </div>
            </Panel>

            {/* Chart — sin gráficas falsas: frame + estado offline */}
            <section className="vt-panel overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-[13px] font-mono text-fg">BTC/USDT</span>
                  <StatusChip tone="offline" label="mercado offline" />
                </div>
                <div className="hidden sm:flex items-center gap-0.5">
                  {TIMEFRAMES.map((t) => (
                    <button
                      key={t}
                      onClick={() => setTf(t)}
                      className={`text-[11px] font-mono px-2 py-1 rounded transition-colors ${
                        tf === t ? 'bg-amber-soft text-amber' : 'text-fg-3 hover:text-fg-2'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div className="relative h-[240px] lg:h-[300px] flex items-center justify-center">
                {/* rejilla de fondo del chart */}
                <div className="absolute inset-0 opacity-40 pointer-events-none"
                  style={{
                    backgroundImage:
                      'linear-gradient(to bottom, transparent 0, transparent calc(20% - 1px), var(--border) 20%), linear-gradient(to right, transparent 0, transparent calc(12.5% - 1px), var(--border) 12.5%)',
                    backgroundSize: '100% 20%, 12.5% 100%',
                  }}
                />
                <div className="relative text-center max-w-[320px] px-4">
                  <div className="mx-auto w-11 h-11 rounded-full border border-border flex items-center justify-center mb-3">
                    <LineChartIcon className="w-5 h-5 text-fg-3" strokeWidth={1.4} />
                  </div>
                  <div className="text-[13px] font-medium text-fg-2">Sin datos de mercado</div>
                  <OfflineNote>
                    El feed de precios llega por el motor, que está apagado por diseño. En cuanto reconecte,
                    el gráfico de velas se dibuja aquí con datos reales.
                  </OfflineNote>
                </div>
              </div>
              {/* métricas al pie */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-px bg-border border-t border-border">
                {[
                  ['Volumen 24H', '—'],
                  ['Rango 24H', '—'],
                  ['Dominio BTC', '—'],
                  ['Funding', '—'],
                  ['Interés Abierto', '—'],
                ].map(([k, v]) => (
                  <div key={k} className="bg-bg-1 px-3 py-2.5">
                    <div className="text-[10px] text-fg-3">{k}</div>
                    <div className="text-[12.5px] font-mono nums text-fg-3">{v}</div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* ── Columna operativa derecha ───────────────────────────────── */}
          <aside className="space-y-4 min-w-0">
            {/* Capital protegido */}
            <Panel title="Capital protegido" icon={ShieldCheck} status={<StatusChip tone="offline" label="sin cuenta" />}>
              <div className="text-center text-[10px] font-mono uppercase tracking-wider text-fg-3 mb-1">
                Postura de la cuenta
              </div>
              <Gauge value={0.5} label="Neutral" sub="Conservador ↔ Agresivo" offline />
              <div className="mt-3 pt-3 border-t border-border">
                <DataRow label="Exposición neta" value="—" />
                <DataRow label="Uso de margen" value="—" />
                <DataRow label="Liquidez" value="—" />
              </div>
              <OfflineNote>Sin datos de cuenta: el motor está offline. No mostramos balances.</OfflineNote>
            </Panel>

            {/* Posiciones abiertas */}
            <Panel
              title="Posiciones abiertas"
              icon={Layers}
              status={<span className="text-[11px] font-mono text-fg-3">0</span>}
              action={
                <Link href="/posiciones" className="text-[10px] font-mono text-amber hover:underline">
                  VER TODO
                </Link>
              }
            >
              <div className="py-2">
                <div className="text-[13px] text-fg-2 font-medium mb-1">Sin posiciones</div>
                <OfflineNote>El motor está apagado; no hay posiciones que mostrar. Estado honesto, sin datos simulados.</OfflineNote>
              </div>
            </Panel>

            {/* Riesgo */}
            <Panel title="Riesgo" icon={GaugeIcon} status={<StatusChip tone="offline" label="sin datos" />}>
              <div className="space-y-2.5">
                <SegmentedBar marker={0} offline />
                <DataRow label="VaR (24H)" value="—" />
                <DataRow label="Drawdown actual" value="—" />
                <DataRow label="Correlación" value="—" />
              </div>
            </Panel>

            {/* Salud del sistema — honesta */}
            <Panel
              title="Salud del sistema"
              icon={Activity}
              status={
                conn.loading ? (
                  <StatusChip tone="neutral" label="…" />
                ) : conn.reachable ? (
                  <StatusChip tone="warn" label="parcial" />
                ) : (
                  <StatusChip tone="offline" label="offline" />
                )
              }
            >
              <div className="divide-y divide-border">
                <HealthRow label="Chat / conversación" ok={conn.reachable} loading={conn.loading} okText="ok" offText="desconocido" />
                <HealthRow label="Conexión a mercados" ok={conn.markets} loading={conn.loading} okText="ok" offText="offline" />
                <HealthRow label="Motor de ejecución" ok={false} loading={false} okText="ok" offText="apagado" />
                <HealthRow label="Servicios de datos" ok={conn.data} loading={conn.loading} okText="ok" offText="offline" />
              </div>
              <Link href="/sistema" className="mt-3 inline-flex items-center gap-1 text-[11px] font-mono text-amber hover:underline">
                Ver sistema <ArrowRight className="w-3 h-3" />
              </Link>
            </Panel>

            {/* Kill switch — honesto y deshabilitado (nada que matar) */}
            <section className="rounded-xl border border-error/25 bg-error-soft p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg border border-error/30 flex items-center justify-center flex-shrink-0">
                  <Power className="w-5 h-5 text-error" strokeWidth={1.6} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-[13px] font-semibold text-fg">Kill switch</h3>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-fg-3 border border-border rounded px-1.5 py-0.5">
                      inactivo
                    </span>
                  </div>
                  <p className="text-[11.5px] text-fg-2 mt-1 leading-relaxed">
                    Cierra todas las posiciones y cancela las órdenes activas. El motor está apagado: no hay nada que
                    detener, por eso queda deshabilitado.
                  </p>
                </div>
              </div>
              <button
                disabled
                aria-disabled="true"
                title="Deshabilitado: el motor está apagado, no hay posiciones ni órdenes activas."
                className="mt-3 w-full flex items-center justify-center gap-2 rounded-lg border border-error/30 bg-error/5 text-error/70 text-[12.5px] font-medium py-2.5 cursor-not-allowed"
              >
                <AlertTriangle className="w-4 h-4" /> Sin nada que detener
              </button>
            </section>
          </aside>
        </div>
      </div>
    </div>
  )
}

function HealthRow({
  label,
  ok,
  loading,
  okText,
  offText,
}: {
  label: string
  ok: boolean
  loading: boolean
  okText: string
  offText: string
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-[12px] text-fg-2">{label}</span>
      {loading ? (
        <StatusChip tone="neutral" label="…" />
      ) : ok ? (
        <StatusChip tone="ok" label={okText} />
      ) : (
        <StatusChip tone="offline" label={offText} />
      )}
    </div>
  )
}
