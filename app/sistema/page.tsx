'use client'

import { useEffect, useState } from 'react'
import { Server, MessageSquare, CandlestickChart, Database, Cpu, Power, AlertTriangle, Eye, ShieldCheck } from 'lucide-react'
import { AppShell } from '@/components/app-shell'
import { Panel, StatusChip, OfflineNote } from '@/components/vt-primitives'
import { api } from '@/lib/api'

type Tone = 'ok' | 'offline' | 'warn' | 'neutral'

interface Connector {
  key: string
  label: string
  icon: typeof Server
  tone: Tone
  status: string
  detail: string
}

export default function SistemaPage() {
  const [reachable, setReachable] = useState<boolean | null>(null)
  const [marketsOk, setMarketsOk] = useState(false)
  const [dataOk, setDataOk] = useState(false)

  useEffect(() => {
    let mounted = true
    const tick = async () => {
      try {
        const r = await api.systemStatus()
        if (!mounted) return
        const find = (n: string) => r.components?.find((c) => c.name.toLowerCase().includes(n))
        setReachable(true)
        setMarketsOk(!!find('market')?.ok || !!find('bybit')?.ok)
        setDataOk(!!find('data')?.ok || !!find('neon')?.ok)
      } catch {
        if (!mounted) return
        setReachable(false)
        setMarketsOk(false)
        setDataOk(false)
      }
    }
    tick()
    const id = setInterval(tick, 30000)
    return () => {
      mounted = false
      clearInterval(id)
    }
  }, [])

  const loading = reachable === null

  const connectors: Connector[] = [
    {
      key: 'frontend',
      label: 'Frontend (Vercel)',
      icon: Server,
      tone: 'ok',
      status: 'activo',
      detail: 'La app que estás viendo. Deploy en Vercel, dominio tanit.work. Sirviendo esta interfaz ahora mismo.',
    },
    {
      key: 'chat',
      label: 'Chat / conversación',
      icon: MessageSquare,
      tone: loading ? 'neutral' : reachable ? 'ok' : 'offline',
      status: loading ? 'verificando…' : reachable ? 'alcanzable' : 'desconocido',
      detail: 'Ruta app → /api/proxy → Hetzner → Grok. Es un conector independiente del motor de trading.',
    },
    {
      key: 'markets',
      label: 'Conexión a mercados (Bybit)',
      icon: CandlestickChart,
      tone: loading ? 'neutral' : marketsOk ? 'ok' : 'offline',
      status: loading ? 'verificando…' : marketsOk ? 'en vivo' : 'offline',
      detail: 'Feed de precios y datos de mercado. Llega a través del motor, que está apagado por diseño.',
    },
    {
      key: 'engine',
      label: 'Motor de ejecución',
      icon: Cpu,
      tone: 'offline',
      status: 'apagado',
      detail: 'Hetzner · PM2 · puerto 8080. Apagado y NO listo para arrancar. No se toca en esta intervención visual.',
    },
    {
      key: 'db',
      label: 'Base de datos (Neon)',
      icon: Database,
      tone: loading ? 'neutral' : dataOk ? 'ok' : 'offline',
      status: loading ? 'verificando…' : dataOk ? 'ok' : 'desconocido',
      detail: 'Persistencia del lado del motor (decisiones, memoria, snapshots). Integración intacta, no se modifica.',
    },
  ]

  return (
    <AppShell title="Sistema">
      <div className="mx-auto w-full max-w-[1000px] px-4 lg:px-6 py-5 lg:py-6 space-y-5">
        <div className="flex items-center gap-3">
          <h2 className="text-[20px] font-semibold text-fg tracking-tight">Sistema</h2>
          <span className="vt-mode-badge font-mono">
            <Eye className="w-3 h-3" strokeWidth={2} /> Modo: Observación
          </span>
        </div>

        {/* Conectores */}
        <Panel title="Conectores" icon={Server}>
          <div className="divide-y divide-border">
            {connectors.map((c) => {
              const Icon = c.icon
              return (
                <div key={c.key} className="flex items-start gap-3 py-3">
                  <div className="w-9 h-9 rounded-lg border border-border flex items-center justify-center flex-shrink-0">
                    <Icon className="w-[18px] h-[18px] text-fg-3" strokeWidth={1.5} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[13px] font-medium text-fg">{c.label}</span>
                      <StatusChip tone={c.tone} label={c.status} />
                    </div>
                    <p className="text-[11.5px] text-fg-3 leading-relaxed mt-1">{c.detail}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </Panel>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Modo de operación */}
          <Panel title="Modo de operación" icon={ShieldCheck}>
            <div className="flex items-center gap-2 mb-2">
              <span className="vt-mode-badge font-mono">
                <Eye className="w-3 h-3" strokeWidth={2} /> Observación
              </span>
            </div>
            <OfflineNote>
              V-TRADING observa el mercado y asiste tus decisiones. No opera de forma autónoma ni ejecuta órdenes en
              esta build. El control siempre lo conservas tú.
            </OfflineNote>
          </Panel>

          {/* Kill switch honesto */}
          <section className="rounded-xl border border-error/25 bg-error-soft p-4 flex flex-col">
            <div className="flex items-center gap-2 mb-2">
              <Power className="w-4 h-4 text-error" strokeWidth={1.6} />
              <h3 className="text-[13px] font-semibold text-fg">Kill switch</h3>
              <span className="text-[10px] font-mono uppercase tracking-wider text-fg-3 border border-border rounded px-1.5 py-0.5">
                inactivo
              </span>
            </div>
            <p className="text-[11.5px] text-fg-2 leading-relaxed flex-1">
              Cierra todas las posiciones y cancela órdenes activas. El motor está apagado: no hay nada que detener, por
              eso queda deshabilitado.
            </p>
            <button
              disabled
              aria-disabled="true"
              title="Deshabilitado: el motor está apagado."
              className="mt-3 w-full flex items-center justify-center gap-2 rounded-lg border border-error/30 bg-error/5 text-error/70 text-[12.5px] font-medium py-2.5 cursor-not-allowed"
            >
              <AlertTriangle className="w-4 h-4" /> Sin nada que detener
            </button>
          </section>
        </div>
      </div>
    </AppShell>
  )
}
