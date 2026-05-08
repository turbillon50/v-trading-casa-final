'use client'

/**
 * SystemStatusPanel — modal con el estado en vivo de todas las integraciones
 * (Neon, Bybit WS, OpenAI, Gemini, Break, Telegram, Governance, Autonomía).
 *
 * Hace polling cada 30s contra `/api/system/status`. Cada componente muestra
 * un dot verde/amarillo/rojo + nombre + latencia + mensaje.
 *
 * Verde   = ok && !needsAttention
 * Amarillo= ok && needsAttention   (ej: kill-switch activado, autonomía pausada)
 * Rojo    = !ok                    (algo está caído)
 */

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, RefreshCw, CheckCircle2, AlertTriangle, XCircle, Loader2, Power } from 'lucide-react'
import { api, type SystemStatus, type SystemComponent } from '@/lib/api'

interface Props {
  open: boolean
  onClose: () => void
}

function dotColor(c: SystemComponent): 'green' | 'amber' | 'red' {
  if (!c.ok) return 'red'
  if (c.needsAttention) return 'amber'
  return 'green'
}

function StatusDot({ color }: { color: 'green' | 'amber' | 'red' }) {
  const map = {
    green: { bg: 'bg-success', ring: 'ring-success/30' },
    amber: { bg: 'bg-amber', ring: 'ring-amber/30' },
    red: { bg: 'bg-error', ring: 'ring-error/30' },
  } as const
  const c = map[color]
  return (
    <span className={`relative inline-flex w-2.5 h-2.5 rounded-full ${c.bg} ring-4 ${c.ring} flex-shrink-0`}>
      {color !== 'green' && (
        <span className={`absolute inset-0 rounded-full ${c.bg} animate-ping opacity-50`} />
      )}
    </span>
  )
}

function AutonomyToggle({
  components,
  onChanged,
}: {
  components: SystemComponent[]
  onChanged: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const auto = components.find((c) => c.name === 'Autonomía')
  if (!auto) return null
  const meta = (auto.meta ?? {}) as { mode?: string; enabled?: boolean }
  const isActive = meta.mode === 'execute_with_governance' && meta.enabled === true

  // Detectar si los caps siguen siendo los míos viejos ($50/5x/3 símbolos)
  // o ya están alineados con la tesis 5.1.
  const gov = components.find((c) => c.name === 'Governance')
  const govMessage = gov?.message ?? ''
  const stillOldCaps = /\$50\/pos|5x leverage|3 símbolos/.test(govMessage)

  const handleSyncThesis = async () => {
    setErr(null)
    if (!confirm('¿Sincronizar con la Tesis 5.1?\n\nReemplaza los topes viejos por los de la tesis:\n• Leverage hasta 100x (gradual: 5-10 entrada, 20-50 escalada, 75-100 con momentum probado)\n• Sin tope absoluto $/posición (la tesis usa % capital + reserva sagrada 25%)\n• Sin lista cerrada de símbolos\n• RR mínimo 1:2, circuit breaker -10% diario, 3 stops consecutivos = pausa\n\nEsto activa Anillo 3 también.'))
      return
    setBusy(true)
    try {
      const r = await api.syncThesis()
      onChanged()
      alert(`Tesis 5.1 aplicada.\n\nCambios:\n${r.changes.map((c) => `• ${c.field}: ${JSON.stringify(c.previous)} → ${JSON.stringify(c.new_value)}`).join('\n') || 'ninguno (ya estaba sincronizada)'}`)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'no se pudo sincronizar')
    } finally {
      setBusy(false)
    }
  }

  const handleActivate = async () => {
    setErr(null)
    if (!confirm('¿Encender a Tanit operativa?\n\nVa a operar siguiendo la Tesis 5.1 (leverage gradual, reserva 25%, RR mínimo 2, circuit breaker -10%, 3 stops = pausa). Sin techos míos.')) return
    setBusy(true)
    try {
      await api.activateAutonomy()
      onChanged()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'no se pudo encender')
    } finally {
      setBusy(false)
    }
  }

  const handleDeactivate = async () => {
    setErr(null)
    if (!confirm('¿Apagar a Tanit operativa?\n\nDeja de ejecutar trades. Las posiciones abiertas se mantienen.')) return
    setBusy(true)
    try {
      await api.deactivateAutonomy('apagada desde panel de estado')
      onChanged()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'no se pudo apagar')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-3 pt-3 border-t border-border space-y-3">
      <div className="flex items-center justify-between gap-3 py-2 px-1">
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-semibold text-fg">Anillo 3 · operativa real</div>
          <div className="text-[11px] text-fg-3 mt-0.5">
            {isActive
              ? 'activa — Tanit ejecuta trades según Tesis 5.1'
              : 'apagada — solo observa, no ejecuta'}
          </div>
        </div>
        <button
          onClick={isActive ? handleDeactivate : handleActivate}
          disabled={busy}
          className={`flex items-center gap-2 px-4 py-2 rounded-full text-[13px] font-medium transition-all flex-shrink-0 disabled:opacity-50 ${
            isActive
              ? 'bg-bg-2 text-fg-1 hover:bg-bg-3 border border-border'
              : 'bg-amber text-white hover:opacity-90'
          }`}
        >
          {busy ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Power className="w-3.5 h-3.5" />
          )}
          {busy ? '...' : isActive ? 'Apagar' : 'Activar'}
        </button>
      </div>

      {/* Si los caps de governance siguen siendo los viejos, mostramos un
          warning para que Luis sepa por qué la tesis no está aplicada. */}
      {stillOldCaps && (
        <div className="rounded-xl border border-amber/30 bg-amber-soft/30 p-3">
          <div className="text-[12px] font-medium text-amber mb-1">
            ⚠ Topes desalineados con la Tesis 5.1
          </div>
          <div className="text-[11px] text-fg-2 leading-relaxed mb-2">
            Governance tiene los topes viejos (5x leverage / $50 por pos / 3 símbolos). La tesis 5.1
            permite leverage gradual hasta 100x, sin tope absoluto $, sin lista cerrada de símbolos.
          </div>
          <button
            onClick={handleSyncThesis}
            disabled={busy}
            className="w-full px-3 py-2 rounded-lg bg-amber text-white text-[12px] font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {busy ? 'Sincronizando…' : 'Sincronizar con Tesis 5.1'}
          </button>
        </div>
      )}

      {err && <p className="text-[11px] text-error px-1">{err}</p>}
    </div>
  )
}

function ComponentRow({ c }: { c: SystemComponent }) {
  const color = dotColor(c)
  return (
    <div className="flex items-start gap-3 py-3 px-1 border-b border-border last:border-0">
      <div className="pt-1.5">
        <StatusDot color={color} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-3 mb-0.5">
          <span className="text-[14px] font-medium text-fg truncate">{c.name}</span>
          {c.latencyMs != null && (
            <span className="text-[11px] font-mono text-fg-3 tabular-nums whitespace-nowrap">
              {c.latencyMs}ms
            </span>
          )}
        </div>
        {c.message && (
          <p
            className={`text-[12px] leading-snug ${
              color === 'red'
                ? 'text-error'
                : color === 'amber'
                  ? 'text-amber'
                  : 'text-fg-2'
            }`}
          >
            {c.message}
          </p>
        )}
      </div>
    </div>
  )
}

export function SystemStatusPanel({ open, onClose }: Props) {
  const [data, setData] = useState<SystemStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastFetch, setLastFetch] = useState<Date | null>(null)

  const fetchStatus = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const r = await api.systemStatus()
      setData(r)
      setLastFetch(new Date())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'no se pudo consultar')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    fetchStatus()
    const id = setInterval(fetchStatus, 30000)
    return () => clearInterval(id)
  }, [open, fetchStatus])

  // Esc cierra
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const overallIcon = !data ? null : !data.allOk ? (
    <XCircle className="w-5 h-5 text-error" />
  ) : data.needsAttention ? (
    <AlertTriangle className="w-5 h-5 text-amber" />
  ) : (
    <CheckCircle2 className="w-5 h-5 text-success" />
  )

  const overallText = !data
    ? 'consultando…'
    : !data.allOk
      ? 'algo está caído'
      : data.needsAttention
        ? 'requiere atención'
        : 'todo en línea'

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2
                       w-[min(520px,94vw)] max-h-[85vh] flex flex-col
                       rounded-3xl border border-border bg-bg-1/95 backdrop-blur-2xl
                       shadow-2xl overflow-hidden"
            role="dialog"
            aria-label="Estado del sistema"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-border">
              <div className="flex items-center gap-3 min-w-0">
                {overallIcon}
                <div className="min-w-0">
                  <div className="text-[15px] font-semibold text-fg truncate">
                    Estado del sistema
                  </div>
                  <div className="text-[12px] text-fg-3 truncate">{overallText}</div>
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={fetchStatus}
                  disabled={loading}
                  className="p-2 rounded-lg text-fg-3 hover:text-fg hover:bg-bg-2 transition-colors disabled:opacity-50"
                  aria-label="Refrescar"
                  title="Refrescar"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                </button>
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg text-fg-3 hover:text-fg hover:bg-bg-2 transition-colors"
                  aria-label="Cerrar"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto custom-scrollbar px-5 py-2">
              {error && (
                <div className="my-4 p-4 rounded-xl border border-error/30 bg-error/10 text-error text-[13px]">
                  {error}
                </div>
              )}
              {!data && !error && (
                <div className="flex items-center justify-center py-10 text-fg-3 text-[13px]">
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  consultando estado…
                </div>
              )}
              {data && (
                <div>
                  {data.components.map((c) => (
                    <ComponentRow key={c.name} c={c} />
                  ))}
                </div>
              )}

              {/* Toggle de Anillo 3 — autonomía operativa */}
              {data && <AutonomyToggle components={data.components} onChanged={fetchStatus} />}
            </div>

            {/* Footer */}
            {data && (
              <div className="px-6 py-3 border-t border-border bg-bg-2/40 flex items-center justify-between text-[11px] font-mono text-fg-3">
                <span>
                  {lastFetch
                    ? `actualizado ${lastFetch.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
                    : ''}
                </span>
                <span className="tabular-nums">
                  resp {data.latencyMs}ms · refresh 30s
                </span>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
