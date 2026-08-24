'use client'

import { useEffect, useRef, useState } from 'react'
import type { Candle } from '@/lib/indicators'

export type Timeframe = '1m' | '5m' | '15m' | '1H' | '4H' | '1D' | '1W'
export type MarketSource = 'COINBASE' | 'OKX'

export interface CandlesState {
  candles: Candle[]
  source: MarketSource | null
  loading: boolean
  error: string | null
}

/** Velas reales de /api/mercado con refresco cada 30s (mismo cache del server). */
export function useCandles(symbol: string, tf: Timeframe): CandlesState {
  const [state, setState] = useState<CandlesState>({
    candles: [],
    source: null,
    loading: true,
    error: null,
  })
  const firstLoad = useRef(true)

  useEffect(() => {
    let mounted = true
    firstLoad.current = true
    setState((s) => ({ ...s, loading: true }))

    async function load() {
      try {
        const r = await fetch(`/api/mercado?symbol=${symbol}&tf=${tf}`, { cache: 'no-store' })
        const j = await r.json()
        if (!mounted) return
        if (!j.ok) {
          setState({ candles: [], source: null, loading: false, error: j.error ?? 'offline' })
          return
        }
        setState({ candles: j.candles, source: j.source, loading: false, error: null })
      } catch {
        if (!mounted) return
        setState((s) => ({ ...s, loading: false, error: 'sin conexión a fuentes de referencia' }))
      } finally {
        firstLoad.current = false
      }
    }

    load()
    const id = setInterval(load, 30_000)
    return () => {
      mounted = false
      clearInterval(id)
    }
  }, [symbol, tf])

  return state
}

export interface Ticker {
  symbol: string
  price: number
  change24hPct: number
  high24h: number
  low24h: number
  volume24h: number
  rsi14: number
  ema20: number
  ema50: number
  ema200: number
  trend: 'alcista' | 'bajista' | 'lateral'
}

export interface TickersState {
  tickers: Ticker[]
  source: MarketSource | null
  loading: boolean
  online: boolean
}

/** Snapshots de BTC/ETH/SOL desde /api/mercado/tickers (refresco 20s). */
export function useTickers(): TickersState {
  const [state, setState] = useState<TickersState>({
    tickers: [],
    source: null,
    loading: true,
    online: false,
  })

  useEffect(() => {
    let mounted = true
    async function load() {
      try {
        const r = await fetch('/api/mercado/tickers', { cache: 'no-store' })
        const j = await r.json()
        if (!mounted) return
        if (!j.ok) {
          setState({ tickers: [], source: null, loading: false, online: false })
          return
        }
        setState({ tickers: j.tickers, source: j.source, loading: false, online: true })
      } catch {
        if (!mounted) return
        setState({ tickers: [], source: null, loading: false, online: false })
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
