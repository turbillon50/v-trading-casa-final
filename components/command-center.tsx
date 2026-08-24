'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
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
import { CandlesChart } from './candles-chart'
import {
  Panel,
  StatusChip,
  OfflineNote,
  DataRow,
  Gauge,
  SegmentedBar,
  ConfidencePips,
} from './vt-primitives'

const QUICK_ACTIONS: { label: string; prompt: string }[] = [
  { label: 'Análisis de mercado', prompt: 'Dame tu lectura del mercado ahora mismo con los precios, RSI y EMAs que traes de BTC, ETH y SOL. ¿Qué ves?' },
  { label: 'Revisar posiciones', prompt: 'Estamos en modo Observación, sin motor. Explícame qué revisarías de las posiciones y riesgo si el motor estuviera vivo, y qué me recomendarías vigilar hoy en el mercado.' },
  { label: 'Escenarios', prompt: 'Con los datos que traes de BTC, plantéame dos escenarios (alcista y bajista) con niveles concretos derivados del precio y las medias.' },
  { label: 'Gestión de riesgo', prompt: 'Con la tendencia y el RSI actuales, ¿cómo plantearías la gestión de riesgo y el tamaño de posición? Habla en concreto con los números de ahora.' },
]

function useConnectors() {
  const [state, setState] = useState<{
    loading: boolean
    chat: boolean
    markets: boolean
    engine: boolean
    data: boolean
  }>({ loading: true, chat: true, markets: false, engine: false, data: false })

  useEffect(() => {
    let mounted = true
    const tick = async () => {
      // El chat va por /api/agente (mesh→gemini), independiente del motor: lo
      // damos por activo sin pegarle al motor muerto. El mercado se prueba
      // contra su fuente real (/api/mercado/tickers), no contra el motor.
      try {
        const r = await fetch('/api/mercado/tickers', { cache: 'no-store' })
        const j = await r.json()
        if (!mounted) return
        setState({
          loading: false,
          chat: true,
          markets: !!j.ok && Array.isArray(j.tickers) && j.tickers.length > 0,
          engine: false,
          data: false,
        })
      } catch {
        if (!mounted) return
        setState({ loading: false, chat: true, markets: false, engine: false, data: false })
      }
    }
    tick()
    const id = setInterval(tick, 30000)
    return () => { mounted = false; clearInterval(id) }
  }, [])

  return state
}

export function CommandCenter() {
  const router = useRouter()
  const [greeting, setGreeting] = useState('Hola')
  const draftRef = useRef<HTMLInputElement>(null)
  const heroRef = useRef<HTMLElement>(null)
  const conn = useConnectors()
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    const h = new Date().getHours()
    setGreeting(h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches')
  }, [])

  /* Spotlight de cursor — throttled con RAF, solo desktop */
  const onPointerMove = useCallback((e: React.PointerEvent<HTMLElement>) => {
    if (e.pointerType === 'touch') return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(() => {
      const el = heroRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      el.style.setProperty('--mx', `${e.clientX - rect.left}px`)
      el.style.setProperty('--my', `${e.clientY - rect.top}px`)
      el.style.setProperty('--spot-opacity', '1')
    })
  }, [])

  const onPointerLeave = useCallback(() => {
    heroRef.current?.style.setProperty('--spot-opacity', '0')
  }, [])

  const go = (text?: string) => {
    if (text) { try { sessionStorage.setItem('vt-draft', text) } catch {} }
    router.push('/chat')
  }

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    go(draftRef.current?.value?.trim() || undefined)
  }

  return (
    <div className="vt-grid min-h-full">
      <div className="lg:hidden px-4 py-3 border-b border-border">
        <MarketTicker variant="bar" />
      </div>

      <div className="mx-auto w-full max-w-[1400px] px-4 lg:px-6 py-5 lg:py-6">
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_336px] gap-5">
          <div className="space-y-5 min-w-0">
            {/* Hero — crystal panel con spotlight */}
            <motion.section
              ref={heroRef}
              onPointerMove={onPointerMove}
              onPointerLeave={onPointerLeave}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="relative overflow-hidden rounded-xl border border-border bg-bg-1/70 p-6 lg:p-7"
              style={{
                /* Spotlight radial que sigue el cursor */
                background: `
                  radial-gradient(600px at var(--mx, 50%) var(--my, 50%),
                    rgba(255,45,135,calc(0.07 * var(--spot-opacity, 0))),
                    transparent),
                  var(--bg-1)
                `,
                ['--spot-opacity' as string]: '0',
              } as React.CSSProperties}
            >
              <div className="relative z-10 max-w-[560px]">
                <h2 className="text-[30px] lg:text-[38px] font-semibold text-fg tracking-[-0.02em] leading-[1.05]">
                  {greeting}, Luis
                </h2>
                <p className="text-[13.5px] text-fg-2 mt-2.5 leading-relaxed max-w-[440px]">
                  V-TRADING está observando el mercado y preparada para ayudarte a tomar mejores decisiones.
                </p>

                <form onSubmit={onSubmit} className="mt-5">
                  <div className="flex items-center gap-2 rounded-xl border border-border bg-bg-2 focus-within:border-rose/50 focus-within:shadow-[0_0_0_1px_rgba(255,45,135,.15)] transition-all duration-200 px-3.5 py-2.5">
                    <input
                      ref={draftRef}
                      type="text"
                      placeholder="Pregunta, analiza o pide una opinión sobre el mercado…"
                      className="flex-1 bg-transparent text-[13.5px] text-fg placeholder:text-fg-3 outline-none min-w-0"
                      aria-label="Habla con V-TRADING"
                    />
                    <motion.button
                      type="submit"
                      whileTap={{ scale: 0.985 }}
                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-rose text-white hover:bg-rose-hover transition-all duration-200 flex-shrink-0"
                      style={{ boxShadow: '0 0 12px rgba(255,45,135,.35)' }}
                      aria-label="Enviar a V-TRADING"
                    >
                      <Send className="w-4 h-4" strokeWidth={2} />
                    </motion.button>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {QUICK_ACTIONS.map((a) => (
                      <motion.button
                        key={a.label}
                        type="button"
                        onClick={() => go(a.prompt)}
                        whileTap={{ scale: 0.985 }}
                        className="text-[11.5px] text-fg-2 hover:text-fg border border-border hover:border-rose/30 hover:-translate-y-px rounded-full px-3 py-1.5 transition-all duration-150 active:scale-[.985]"
                      >
                        {a.label}
                      </motion.button>
                    ))}
                  </div>
                </form>
              </div>

              {/* Orbe rosa — bloom localizado */}
              <div className="hidden sm:block absolute right-4 lg:right-8 top-1/2 -translate-y-1/2 opacity-90 pointer-events-none">
                <TanitOrb state="idle" size="xl" />
              </div>
            </motion.section>

            {/* Tesis actual */}
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

            <CandlesChart symbol="BTC" defaultTf="1H" defaultInd={['ema20', 'ema50', 'vol']} />
          </div>

          <aside className="space-y-4 min-w-0">
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

            <Panel
              title="Posiciones abiertas"
              icon={Layers}
              status={<span className="text-[11px] font-mono text-fg-3">0</span>}
              action={
                <Link href="/posiciones" className="text-[10px] font-mono text-rose hover:underline">
                  VER TODO
                </Link>
              }
            >
              <div className="py-2">
                <div className="text-[13px] text-fg-2 font-medium mb-1">Sin posiciones</div>
                <OfflineNote>El motor está apagado; no hay posiciones que mostrar. Estado honesto, sin datos simulados.</OfflineNote>
              </div>
            </Panel>

            <Panel title="Riesgo" icon={GaugeIcon} status={<StatusChip tone="offline" label="sin datos" />}>
              <div className="space-y-2.5">
                <SegmentedBar marker={0} offline />
                <DataRow label="VaR (24H)" value="—" />
                <DataRow label="Drawdown actual" value="—" />
                <DataRow label="Correlación" value="—" />
              </div>
            </Panel>

            <Panel
              title="Salud del sistema"
              icon={Activity}
              status={
                conn.loading ? (
                  <StatusChip tone="neutral" label="…" />
                ) : conn.markets ? (
                  <StatusChip tone="warn" label="parcial" />
                ) : (
                  <StatusChip tone="offline" label="offline" />
                )
              }
            >
              <div className="divide-y divide-border">
                <HealthRow label="Chat / conversación" ok={conn.chat} loading={conn.loading} okText="activo" offText="—" />
                <HealthRow label="Conexión a mercados" ok={conn.markets} loading={conn.loading} okText="en vivo" offText="offline" />
                <HealthRow label="Motor de ejecución" ok={false} loading={false} okText="ok" offText="apagado" />
                <HealthRow label="Servicios de datos" ok={conn.data} loading={conn.loading} okText="ok" offText="offline" />
              </div>
              <Link href="/sistema" className="mt-3 inline-flex items-center gap-1 text-[11px] font-mono text-rose hover:underline">
                Ver sistema <ArrowRight className="w-3 h-3" />
              </Link>
            </Panel>

            {/* Kill switch — rojo (es peligro, no marca) */}
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
  label, ok, loading, okText, offText,
}: {
  label: string; ok: boolean; loading: boolean; okText: string; offText: string
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
