'use client'

import { type ReactNode, type ElementType } from 'react'

/* ── Panel modular ───────────────────────────────────────────────────────── */
export function Panel({
  title,
  icon: Icon,
  status,
  action,
  children,
  className = '',
}: {
  title: string
  icon?: ElementType
  status?: ReactNode
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`vt-panel p-4 ${className}`}>
      <header className="flex items-center justify-between mb-3.5">
        <div className="flex items-center gap-2 min-w-0">
          {Icon && <Icon className="w-4 h-4 text-fg-3 flex-shrink-0" strokeWidth={1.6} />}
          <h3 className="text-[13px] font-semibold text-fg tracking-tight truncate">{title}</h3>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {status}
          {action}
        </div>
      </header>
      {children}
    </section>
  )
}

/* ── Chip de estado ──────────────────────────────────────────────────────── */
type Tone = 'ok' | 'offline' | 'warn' | 'neutral'
const toneMap: Record<Tone, string> = {
  ok: 'text-success',
  offline: 'text-fg-3',
  warn: 'text-rose',
  neutral: 'text-fg-2',
}
const dotMap: Record<Tone, string> = {
  ok: 'bg-success',
  offline: 'bg-fg-3/60',
  warn: 'bg-rose',
  neutral: 'bg-fg-3',
}
export function StatusChip({ tone = 'neutral', label }: { tone?: Tone; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-mono ${toneMap[tone]}`}>
      {tone === 'ok' ? (
        <span className={`w-1.5 h-1.5 rounded-full ${dotMap[tone]}`} />
      ) : tone === 'warn' ? (
        <span className="vt-live-dot" style={{ width: 6, height: 6 }} />
      ) : (
        <span className={`w-1.5 h-1.5 rounded-full ${dotMap[tone]}`} />
      )}
      {label}
    </span>
  )
}

/* ── Estado offline / vacío ──────────────────────────────────────────────── */
export function OfflineNote({ children }: { children: ReactNode }) {
  return <p className="text-[11.5px] text-fg-3 leading-relaxed">{children}</p>
}

/* ── Fila label→valor ────────────────────────────────────────────────────── */
export function DataRow({
  label,
  value,
  tone = 'neutral',
}: {
  label: string
  value: ReactNode
  tone?: Tone
}) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-[12px] text-fg-3">{label}</span>
      <span className={`text-[12.5px] font-mono nums ${toneMap[tone] === 'text-fg-2' ? 'text-fg' : toneMap[tone]}`}>{value}</span>
    </div>
  )
}

/* ── Gauge semicircular ──────────────────────────────────────────────────── */
export function Gauge({
  value,
  label,
  sub,
  offline = false,
}: {
  value: number
  label: string
  sub?: string
  offline?: boolean
}) {
  const v = Math.max(0, Math.min(1, value))
  const angle = -90 + v * 180
  const r = 52
  const cx = 60
  const cy = 60
  const arc = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`
  const stroke = offline ? 'var(--fg-3)' : 'var(--rose)'
  return (
    <div className="flex flex-col items-center">
      <svg width="120" height="70" viewBox="0 0 120 66" className="overflow-visible">
        <path d={arc} fill="none" stroke="var(--border)" strokeWidth="6" strokeLinecap="round" />
        <path
          d={arc}
          fill="none"
          stroke={stroke}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={Math.PI * r}
          strokeDashoffset={Math.PI * r * (1 - v)}
          opacity={offline ? 0.4 : 0.95}
          style={offline ? undefined : { filter: 'drop-shadow(0 0 6px var(--rose-glow))' }}
        />
        <line
          x1={cx}
          y1={cy}
          x2={cx + Math.cos((angle * Math.PI) / 180) * (r - 8)}
          y2={cy + Math.sin((angle * Math.PI) / 180) * (r - 8)}
          stroke={offline ? 'var(--fg-3)' : 'var(--fg)'}
          strokeWidth="2"
          strokeLinecap="round"
        />
        <circle cx={cx} cy={cy} r="3.5" fill={offline ? 'var(--fg-3)' : 'var(--rose)'} />
      </svg>
      <div className="text-center -mt-1">
        <div className={`text-[15px] font-semibold ${offline ? 'text-fg-3' : 'text-fg'}`}>{label}</div>
        {sub && <div className="text-[10px] text-fg-3 mt-0.5">{sub}</div>}
      </div>
    </div>
  )
}

/* ── Barra de riesgo segmentada ──────────────────────────────────────────── */
export function SegmentedBar({
  marker,
  segments = 7,
  offline = false,
}: {
  marker: number
  segments?: number
  offline?: boolean
}) {
  const m = Math.max(0, Math.min(1, marker))
  const colorAt = (i: number) => {
    const t = i / (segments - 1)
    if (offline) return 'var(--border-1)'
    if (t < 0.4) return 'var(--success)'
    if (t < 0.72) return 'var(--warn)'
    return 'var(--error)'
  }
  return (
    <div className="relative">
      <div className="flex gap-1">
        {Array.from({ length: segments }).map((_, i) => (
          <div
            key={i}
            className="flex-1 h-2 rounded-full"
            style={{ background: colorAt(i), opacity: offline ? 0.5 : 0.85 }}
          />
        ))}
      </div>
      {!offline && (
        <div
          className="absolute -top-1 w-0.5 h-4 bg-fg rounded-full"
          style={{ left: `calc(${m * 100}% - 1px)` }}
        />
      )}
    </div>
  )
}

/* ── Pips de confianza ───────────────────────────────────────────────────── */
export function ConfidencePips({ filled, total = 6, offline = false }: { filled: number; total?: number; offline?: boolean }) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className="h-1.5 rounded-full transition-colors"
          style={{
            width: 12,
            background: offline ? 'var(--border-1)' : i < filled ? 'var(--rose)' : 'var(--border-1)',
            boxShadow: !offline && i < filled ? '0 0 6px var(--rose-glow)' : undefined,
          }}
        />
      ))}
    </div>
  )
}
