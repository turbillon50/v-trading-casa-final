'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'

/**
 * Lee estado vivo del sistema cada 5s para el StatusBar inferior.
 * Combina /tanit/state + /portfolio/balance + /portfolio/positions.
 *
 * Si alguna call falla, se mantiene el último valor conocido y los flags
 * pasan a offline para que la UI lo refleje sin romper.
 */
export interface LiveStatus {
  tanitOnline: boolean
  bybitLive: boolean
  memoryCount: number
  chatCount: number
  positionsCount: number
  /** Total equity USD (incluye PnL no realizado). */
  equity: number
  /** Saldo disponible para nuevos trades. */
  available: number
  /** PnL no realizado de las posiciones abiertas. */
  pnl: number
  haltActive: boolean
  testnet: boolean
}

export function useLiveStatus(): LiveStatus {
  const [s, setS] = useState<LiveStatus>({
    tanitOnline: false,
    bybitLive: false,
    memoryCount: 0,
    chatCount: 0,
    positionsCount: 0,
    equity: 0,
    available: 0,
    pnl: 0,
    haltActive: false,
    testnet: false,
  })

  useEffect(() => {
    let mounted = true
    async function load() {
      const [stateRes, balanceRes, posRes] = await Promise.all([
        api.state().catch(() => null),
        api.balance().catch(() => null),
        api.positions().catch(() => [] as Awaited<ReturnType<typeof api.positions>>),
      ])
      if (!mounted) return
      setS({
        tanitOnline: !!stateRes?.ok,
        bybitLive: !!balanceRes,
        memoryCount: stateRes?.state.memoryCount ?? 0,
        chatCount: stateRes?.state.chatCount ?? 0,
        positionsCount: posRes?.length ?? 0,
        equity: balanceRes?.totalEquity ?? 0,
        available: balanceRes?.availableBalance ?? 0,
        pnl: balanceRes?.unrealizedPnl ?? 0,
        testnet: balanceRes?.testnet ?? false,
        haltActive: false,
      })
    }
    load()
    const id = setInterval(load, 5_000)
    return () => {
      mounted = false
      clearInterval(id)
    }
  }, [])

  return s
}
