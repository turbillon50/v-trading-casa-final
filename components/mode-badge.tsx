'use client'

import { Eye } from 'lucide-react'

/**
 * Badge permanente "Modo: Observación" — estado honesto del sistema.
 * V-TRADING está observando; no opera de forma autónoma en esta build.
 */
export function ModeBadge({ className = '' }: { className?: string }) {
  return (
    <span className={`vt-mode-badge font-mono ${className}`} title="V-TRADING observa el mercado; no ejecuta órdenes de forma autónoma.">
      <Eye className="w-3 h-3" strokeWidth={2} />
      Modo: Observación
    </span>
  )
}
