'use client'

import { useTickers } from '@/hooks/use-market'

/**
 * Ticker compacto de 3 pares con precios de REFERENCIA (Coinbase → OKX) vía
 * /api/mercado/tickers. Independiente del motor. Si las fuentes caen se muestra
 * estado OFFLINE honesto ("—" + dot atenuado). NUNCA precios inventados.
 */
export function MarketTicker({ variant = 'bar' }: { variant?: 'bar' | 'stack' }) {
  const { tickers, loading } = useTickers()

  const cell = (sym: string) => {
    const t = tickers.find((x) => x.symbol === sym)
    const pos = (t?.change24hPct ?? 0) >= 0
    return (
      <div key={sym} className="flex items-center gap-2 whitespace-nowrap">
        <span className="text-[11px] font-mono text-fg-3">{sym}/USD</span>
        <span className="text-[12px] font-mono nums text-fg tabular-nums">
          {t ? (t.price >= 100 ? t.price.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : t.price.toFixed(2)) : '—'}
        </span>
        {t ? (
          <span className={`text-[11px] font-mono nums ${pos ? 'text-success' : 'text-error'}`}>
            {pos ? '+' : ''}
            {t.change24hPct.toFixed(2)}%
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[10px] font-mono text-fg-3" title="Sin datos de las fuentes de referencia">
            <span className="w-1.5 h-1.5 rounded-full bg-fg-3/60" />
            {loading ? '…' : 'offline'}
          </span>
        )}
      </div>
    )
  }

  const syms = ['BTC', 'ETH', 'SOL']
  if (variant === 'stack') {
    return <div className="flex flex-col gap-2">{syms.map(cell)}</div>
  }
  return <div className="flex items-center gap-5 overflow-x-auto no-scrollbar">{syms.map(cell)}</div>
}
