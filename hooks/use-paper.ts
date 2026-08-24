'use client'

import { useEffect, useState } from 'react'

export interface PaperTrade {
  id: number
  symbol: string
  side: 'long' | 'short'
  size: number
  entry_price: number
  leverage: number
  stop_loss: number | null
  take_profit: number | null
  trailing_sl: number | null
  thesis: string
  thesis_version: string | null
  funding_at_entry: number | null
  oi_at_entry: number | null
  basis_at_entry: number | null
  opened_at: string
  closed_at: string | null
  exit_price: number | null
  gross_pnl: number | null
  fee_estimada: number | null
  net_pnl: number | null
  outcome: 'open' | 'win' | 'loss' | 'breakeven'
  motivo_cierre: string | null
  last_mark_price: number | null
  unrealized_pnl: number | null
  agente_version: string
  best_price: number | null
  funding_cost: number | null
  slippage_est: number | null
}

export interface ThesisMetrics {
  version: string
  cerradas: number
  abiertas: number
  wins: number
  losses: number
  win_rate: number
  net_total: number
  gross_total: number
  fees_total: number
  fee_bite_ratio: number | null
  expectativa_por_op: number
  avg_win: number
  avg_loss: number
}

export interface PaperMetrics {
  cerradas: number
  abiertas: number
  wins: number
  losses: number
  win_rate: number
  net_total: number
  gross_total: number
  fees_total: number
  funding_total: number
  fee_bite_ratio: number | null
  expectativa_por_op: number
  avg_win: number
  avg_loss: number
  unrealized_abierto: number
  por_tesis: ThesisMetrics[]
}

export interface PaperState {
  trades: PaperTrade[]
  metrics: PaperMetrics | null
  online: boolean
  loading: boolean
  error: string | null
}

/** Operaciones en papel + metricas acumuladas. Refresco cada 20s. */
export function usePaper(): PaperState {
  const [state, setState] = useState<PaperState>({
    trades: [],
    metrics: null,
    online: false,
    loading: true,
    error: null,
  })

  useEffect(() => {
    let mounted = true
    async function load() {
      try {
        const [lr, mr] = await Promise.all([
          fetch('/api/papel/list?limit=100', { cache: 'no-store' }).then((r) => r.json()),
          fetch('/api/papel/metrics', { cache: 'no-store' }).then((r) => r.json()),
        ])
        if (!mounted) return
        if (!lr.ok && !mr.ok) {
          setState((s) => ({ ...s, online: false, loading: false, error: 'feed de papel sin respuesta' }))
          return
        }
        setState({
          trades: lr.ok ? lr.trades : [],
          metrics: mr.ok ? mr.metrics : null,
          online: true,
          loading: false,
          error: null,
        })
      } catch {
        if (mounted) setState((s) => ({ ...s, online: false, loading: false, error: 'sin conexion' }))
      }
    }
    load()
    const id = setInterval(load, 20_000)
    return () => {
      mounted = false
      clearInterval(id)
    }
  }, [])

  return state
}
