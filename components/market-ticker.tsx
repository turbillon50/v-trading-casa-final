'use client'

import { useTickers } from '@/hooks/use-market'

/**
 * Ticker compacto de 3 pares con precios de REFERENCIA (Coinbase → OKX) vía
 * /api/mercado/tickers. Independiente del motor. Si las fuentes caen se muestra
 * estado OFFLINE honesto ("—" + dot atenuado). NUNCA precios inventados.
 */
export function MarketTicker({ variant = 'bar' }: { variant?: 'bar' | 'stack' }) {
  const { tickers, source, online, loading } = useTickers()

  const cell = (sym: string) => {
    const t = tickers.find((x) => x.symbol === sym)
    const pos = (t?.change24hPct ?? 0) >= 0
    return (
      <div key={sym} className="flex items-center gap-2 whitespace-nowrap">
        <span className="text-[11px] font-mono text-fg-3">{sym}/USD</span>
        <span className="text-[12px] font-mono nums text-fg tabular-nums">
          {t ? (t.price >= 100 ? t.price.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : t.price.toFixed(2)) : '—'}
        </span>
        {/* Si hay precio real mostramos SU cambio 24h. Si no, un guion neutro:
            nunca la palabra "offline" pegada a un precio real (era la
            contradicción medida). "offline" se reserva para el estado global
            del feed, abajo, cuando NO hay ninguna fuente. */}
        {t ? (
          <span className={`text-[11px] font-mono nums ${pos ? 'text-success' : 'text-error'}`}>
            {pos ? '+' : ''}
            {t.change24hPct.toFixed(2)}%
          </span>
        ) : (
          <span className="text-[11px] font-mono text-fg-3" title="Sin dato de este par ahora mismo">—</span>
        )}
      </div>
    )
  }

  // Chip de fuente: la verdad del ticker. Con precio real decimos de dónde
  // viene (referencia · COINBASE/OKX); "offline" SOLO si el feed entero cayó.
  const sourceChip = (
    <span
      className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider whitespace-nowrap"
      title={online ? `Precios de referencia de ${source}` : 'Sin conexión a las fuentes de referencia'}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${online ? 'bg-success' : 'bg-fg-3/60'}`} />
      <span className={online ? 'text-fg-3' : 'text-fg-3'}>
        {online && source ? `referencia · ${source}` : loading ? '…' : 'offline'}
      </span>
    </span>
  )

  const syms = ['BTC', 'ETH', 'SOL']
  if (variant === 'stack') {
    return (
      <div className="flex flex-col gap-2">
        {syms.map(cell)}
        <div className="pt-1">{sourceChip}</div>
      </div>
    )
  }
  return (
    <div className="flex items-center gap-5 overflow-x-auto no-scrollbar">
      {syms.map(cell)}
      <span className="opacity-70">{sourceChip}</span>
    </div>
  )
}
