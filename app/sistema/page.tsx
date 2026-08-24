'use client'

import { useEffect, useState } from 'react'
import { Server, MessageSquare, CandlestickChart, Database, Cpu, Power, AlertTriangle, Eye, ShieldCheck, Brain } from 'lucide-react'
import { AppShell } from '@/components/app-shell'
import { Panel, StatusChip, OfflineNote } from '@/components/vt-primitives'

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
  // Mercado: se prueba contra las fuentes de REFERENCIA (Coinbase → OKX) vía
  // /api/mercado/tickers, que es independiente del motor. Nada de systemStatus
  // del motor muerto aquí.
  const [marketsOk, setMarketsOk] = useState<boolean | null>(null)
  const [marketSource, setMarketSource] = useState<string | null>(null)
  // Vía real por la que respondió el chat la última vez (mesh | gemini | none).
  const [lastVia, setLastVia] = useState<string | null>(null)
  const [lastViaAgo, setLastViaAgo] = useState<string | null>(null)
  // Estado real de la memoria viva de la agente (solo lectura, /api/memoria/estado).
  const [mem, setMem] = useState<{
    connected: boolean
    total: number
    identityCount: number
    lessonCount: number
    latestAt: string | null
    retrieval: 'semantic' | 'text'
    ownerMode: boolean
  } | null>(null)

  useEffect(() => {
    let mounted = true
    const tick = async () => {
      try {
        const r = await fetch('/api/mercado/tickers', { cache: 'no-store' })
        const j = await r.json()
        if (!mounted) return
        setMarketsOk(!!j.ok && Array.isArray(j.tickers) && j.tickers.length > 0)
        setMarketSource(j.source ?? null)
      } catch {
        if (!mounted) return
        setMarketsOk(false)
        setMarketSource(null)
      }
      // Estado real de la memoria de la agente (conectada, cuántos recuerdos, fecha).
      try {
        const mr = await fetch('/api/memoria/estado', { cache: 'no-store' })
        const mj = await mr.json()
        if (mounted) setMem(mj)
      } catch {
        if (mounted) setMem({ connected: false, total: 0, identityCount: 0, lessonCount: 0, latestAt: null, retrieval: 'text', ownerMode: false })
      }
      // Vía real del chat desde localStorage (la escribe el hook al responder).
      try {
        const via = window.localStorage.getItem('vt-last-via')
        const ts = Number(window.localStorage.getItem('vt-last-via-ts') || 0)
        if (mounted && via) {
          setLastVia(via)
          if (ts > 0) {
            const diff = Date.now() - ts
            setLastViaAgo(
              diff < 60_000 ? 'hace un momento'
                : diff < 3_600_000 ? `hace ${Math.floor(diff / 60_000)} min`
                : diff < 86_400_000 ? `hace ${Math.floor(diff / 3_600_000)} h`
                : `hace ${Math.floor(diff / 86_400_000)} d`,
            )
          }
        }
      } catch { /* ignore */ }
    }
    tick()
    const id = setInterval(tick, 30000)
    return () => {
      mounted = false
      clearInterval(id)
    }
  }, [])

  const marketsLoading = marketsOk === null
  const memLoading = mem === null
  const memLatest = mem?.latestAt
    ? new Date(mem.latestAt).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
    : null
  const viaLabel = lastVia === 'mesh' ? 'malla neuronal (Cerebras)'
    : lastVia === 'gemini' ? 'respaldo Gemini'
    : lastVia === 'none' ? 'ninguna vía respondió'
    : null

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
      label: 'Agente / conversación',
      icon: MessageSquare,
      tone: 'ok',
      status: 'activo',
      detail:
        'La conversación va por la malla neuronal (mesh · Cerebras) con respaldo Gemini, vía /api/agente. Es independiente del motor de trading (apagado).'
        + (viaLabel ? ` Última respuesta vía: ${viaLabel}${lastViaAgo ? ` · ${lastViaAgo}` : ''}.` : ''),
    },
    {
      key: 'memory',
      label: 'Memoria de la agente (Tanit)',
      icon: Brain,
      tone: memLoading ? 'neutral' : mem?.connected ? 'ok' : 'offline',
      status: memLoading
        ? 'verificando…'
        : mem?.connected
          ? `conectada · ${mem.total} recuerdos`
          : 'sin memoria',
      detail: memLoading
        ? 'Consultando la base viva de la agente…'
        : mem?.connected
          ? `Su base real (Neon + pgvector, solo lectura): ${mem.total} recuerdos, ${mem.identityCount} de identidad y ${mem.lessonCount} lecciones. `
            + `Recuperación ${mem.retrieval === 'semantic' ? 'semántica (embeddings)' : 'por texto'}. `
            + (memLatest ? `El más reciente es del ${memLatest}. ` : '')
            + 'Se inyecta en cada turno para que no arranque de cero. Lo íntimo queda separado y no se conecta aquí.'
          : 'La base de memoria no respondió. La agente sigue viva pero sin recuerdos en este momento — y lo dice, no lo finge.',
    },
    {
      key: 'markets',
      label: 'Datos de mercado (Coinbase)',
      icon: CandlestickChart,
      tone: marketsLoading ? 'neutral' : marketsOk ? 'ok' : 'offline',
      status: marketsLoading ? 'verificando…' : marketsOk ? `en vivo${marketSource ? ` · ${marketSource}` : ''}` : 'offline',
      detail: 'Precios de referencia de Coinbase con respaldo OKX, vía /api/mercado. Independiente del motor: alimenta el ticker, las velas y el contexto de la agente. No es el balance de la cuenta.',
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
      tone: 'offline',
      status: 'offline',
      detail: 'Persistencia del lado del motor (decisiones, memoria, snapshots). Como el motor está apagado, no hay lecturas de cuenta; la integración queda intacta, no se modifica.',
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
