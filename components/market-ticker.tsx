'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'

const SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'] as const
type Sym = (typeof SYMBOLS)[number]

interface Tick {
  symbol: Sym
  price: number | null
  change: number | null
  online: boolean
  loading: boolean
}

/**
 * Ticker compacto de 3 pares. Los precios vienen del backend (Bybit vía
 * proxy). Con el motor apagado la llamada falla → se muestra estado OFFLINE
 * honesto ("—" + dot atenuado). NUNCA precios inventados.
 */
export function MarketTicker({ variant = 'bar' }: { variant?: 'bar' | 'stack' }) {
  const [ticks, setTicks] = useState<Tick[]>(() =>
    SYMBOLS.map((s) => ({ symbol: s, price: null, change: null, online: false, loading: true })),
  )

  useEffect(() => {
    let mounted = true
    async function load() {
      const results = await Promise.all(
        SYMBOLS.map(async (s): Promise<Tick> => {
          try {
            const t = await api.ticker(s)
            return { symbol: s, price: t.price ?? null, change: t.changePercent24h ?? null, online: t.price != null, loading: false }
          } catch {
            return { symbol: s, price: null, change: null, online: false, loading: false }
          }
        }),
      )
      if (mounted) setTicks(results)
    }
    load()
    const id = setInterval(load, 8000)
    return () => {
      mounted = false
      clearInterval(id)
    }
  }, [])

  const cell = (t: Tick) => {
    const pos = (t.change ?? 0) >= 0
    return (
      <div key={t.symbol} className="flex items-center gap-2 whitespace-nowrap">
        <span className="text-[11px] font-mono text-fg-3">{t.symbol.replace('USDT', '')}/USDT</span>
        <span className="text-[12px] font-mono nums text-fg">
          {t.price != null ? (t.price >= 100 ? t.price.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : t.price.toFixed(2)) : '—'}
        </span>
        {t.change != null ? (
          <span className={`text-[11px] font-mono nums ${pos ? 'text-success' : 'text-error'}`}>
            {pos ? '+' : ''}
            {t.change.toFixed(2)}%
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[10px] font-mono text-fg-3" title="Sin datos: el motor de mercado está offline">
            <span className="w-1.5 h-1.5 rounded-full bg-fg-3/60" />
            offline
          </span>
        )}
      </div>
    )
  }

  if (variant === 'stack') {
    return <div className="flex flex-col gap-2">{ticks.map(cell)}</div>
  }

  return (
    <div className="flex items-center gap-5 overflow-x-auto no-scrollbar">
      {ticks.map(cell)}
    </div>
  )
}
