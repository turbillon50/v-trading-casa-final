'use client'

import { useState } from 'react'
import { CandlestickChart } from 'lucide-react'
import { AppShell } from '@/components/app-shell'
import { Panel, StatusChip, OfflineNote, DataRow } from '@/components/vt-primitives'
import { CandlesChart } from '@/components/candles-chart'
import { useTickers, type Ticker } from '@/hooks/use-market'

const SYMBOLS = ['BTC', 'ETH', 'SOL'] as const

function fmt(n: number, dp = 2): string {
  if (!isFinite(n)) return '—'
  return n.toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp })
}

function SymbolCard({
  sym,
  t,
  active,
  onSelect,
  loading,
  index,
}: {
  sym: string
  t?: Ticker
  active: boolean
  onSelect: () => void
  loading: boolean
  index: number
}) {
  const pos = (t?.change24hPct ?? 0) >= 0
  return (
    <button
      onClick={onSelect}
      style={{ ['--vt-i' as string]: index }}
      className={`vt-rise text-left vt-panel p-4 transition-colors ${active ? 'border-amber/50' : 'hover:border-border-1'}`}
      aria-pressed={active}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <CandlestickChart className="w-4 h-4 text-fg-3" strokeWidth={1.6} />
          <h3 className="text-[13px] font-semibold text-fg tracking-tight">{sym}/USD</h3>
        </div>
        {t ? (
          <StatusChip tone="ok" label={t.trend} />
        ) : (
          <StatusChip tone="offline" label={loading ? '…' : 'offline'} />
        )}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-[22px] font-semibold font-mono nums text-fg tabular-nums">
          {t ? fmt(t.price, t.price >= 100 ? 1 : 4) : '—'}
        </span>
        {t && (
          <span className={`text-[12px] font-mono nums ${pos ? 'text-success' : 'text-error'}`}>
            {pos ? '+' : ''}
            {t.change24hPct.toFixed(2)}%
          </span>
        )}
      </div>
      <div className="mt-3 pt-3 border-t border-border">
        <DataRow label="Máx. 24H" value={t ? fmt(t.high24h, t.price >= 100 ? 1 : 4) : '—'} />
        <DataRow label="Mín. 24H" value={t ? fmt(t.low24h, t.price >= 100 ? 1 : 4) : '—'} />
        <DataRow label="RSI 14" value={t ? fmt(t.rsi14, 0) : '—'} />
      </div>
    </button>
  )
}

export default function MercadoPage() {
  const { tickers, source, online, loading } = useTickers()
  const [sym, setSym] = useState<string>('BTC')

  return (
    <AppShell title="Mercado">
      <div className="mx-auto w-full max-w-[1400px] px-4 lg:px-6 py-5 lg:py-6 space-y-5">
        <div className="flex items-center gap-3">
          <h2 className="text-[20px] font-semibold text-fg tracking-tight">Mercado</h2>
          {online ? (
            <StatusChip tone="ok" label={`referencia · ${source}`} />
          ) : (
            <StatusChip tone="offline" label={loading ? 'cargando' : 'fuentes offline'} />
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {SYMBOLS.map((s, i) => (
            <SymbolCard
              key={s}
              index={i}
              sym={s}
              t={tickers.find((x) => x.symbol === s)}
              active={sym === s}
              onSelect={() => setSym(s)}
              loading={loading}
            />
          ))}
        </div>

        {/* Gráfico de velas del símbolo seleccionado */}
        <CandlesChart symbol={sym} defaultTf="1H" defaultInd={['ema20', 'ema50', 'ema200', 'vol', 'rsi']} />

        <Panel title="Nota de referencia" icon={CandlestickChart} status={<StatusChip tone="warn" label="observación" />}>
          <OfflineNote>
            Los precios, velas e indicadores provienen de fuentes públicas de referencia (Coinbase, respaldo OKX) y
            se calculan sobre esas velas reales. NO son la cuenta ni el motor: posiciones, balances y ejecución
            siguen offline por diseño en esta build de Observación.
          </OfflineNote>
        </Panel>
      </div>
    </AppShell>
  )
}
