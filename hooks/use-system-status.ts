/**
 * Hook ligero que hace polling al endpoint de status del sistema y devuelve
 * solo lo mínimo que necesita la sidebar — un flag global de "necesita
 * atención" + "todo ok" — sin volcar todos los componentes hasta que el
 * usuario abra el panel.
 *
 * Polling: 60s (la sidebar no necesita realtime; el panel hace 30s solo).
 */

'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'

interface SystemStatusSummary {
  loading: boolean
  allOk: boolean
  needsAttention: boolean
  reachable: boolean // false si el endpoint mismo falló
}

export function useSystemStatus(intervalMs = 60_000): SystemStatusSummary {
  const [state, setState] = useState<SystemStatusSummary>({
    loading: true,
    allOk: false,
    needsAttention: false,
    reachable: true,
  })

  useEffect(() => {
    let cancelled = false
    const tick = async () => {
      try {
        const r = await api.systemStatus()
        if (cancelled) return
        setState({
          loading: false,
          allOk: !!r.allOk,
          needsAttention: !!r.needsAttention,
          reachable: true,
        })
      } catch {
        if (cancelled) return
        setState({
          loading: false,
          allOk: false,
          needsAttention: true,
          reachable: false,
        })
      }
    }
    tick()
    const id = setInterval(tick, intervalMs)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [intervalMs])

  return state
}
