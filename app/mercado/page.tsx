'use client'

import { useState } from 'react'
import { CandlestickChart, Activity } from 'lucide-react'
import { AppShell } from '@/components/app-shell'
import { Panel, StatusChip, OfflineNote, DataRow } from '@/components/vt-primitives'
import { CandlesChart } from '@/components/candles-chart'
import { useTickers, usePerp, type Ticker } from '@/hooks/use-market'

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
      className={`vt-rise text-left vt-panel p-4 transition-colors ${active ? 'border-rose/50' : 'hover:border-border-1'}`}
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

function fmtSigned(n: number, dp = 4): string {
  if (!isFinite(n)) return '—'
  return `${n >= 0 ? '+' : ''}${n.toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp })}`
}

function PerpPanel({ sym }: { sym: string }) {
  const { perp, online, loading } = usePerp(sym)
  return (
    <Panel
      title={`Perpetuo · ${sym}USDT`}
      icon={Activity}
      status={
        online ? (
          <StatusChip tone="ok" label="PERPETUO · BYBIT" />
        ) : (
          <StatusChip tone="offline" label={loading ? '…' : 'feed offline'} />
        )
      }
    >
      {perp ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
          <div>
            <DataRow label="Mark price" value={fmt(perp.markPrice, perp.markPrice >= 100 ? 1 : 4)} />
            <DataRow label="Index price" value={fmt(perp.indexPrice, perp.indexPrice >= 100 ? 1 : 4)} />
            <DataRow
              label="Basis (mark − index)"
              value={`${fmtSigned(perp.basis, 2)} (${fmtSigned(perp.basisPct, 4)}%)`}
              tone={perp.basis >= 0 ? 'ok' : 'warn'}
            />
          </div>
          <div>
            <DataRow
              label="Funding rate"
              value={`${fmtSigned(perp.fundingRate * 100, 4)}%`}
              tone={perp.fundingRate >= 0 ? 'ok' : 'warn'}
            />
            <DataRow
              label="Funding anualizado"
              value={`${fmtSigned(perp.fundingAnnualPct, 2)}%`}
              tone={perp.fundingAnnualPct >= 0 ? 'ok' : 'warn'}
            />
            <DataRow label="Open interest" value={`${fmt(perp.openInterest, 0)} contratos`} />
          </div>
        </div>
      ) : (
        <OfflineNote>
          El feed de perpetuos (Bybit vía Hetzner) no respondió. Las velas y precios de arriba caen a la
          referencia pública. Funding, OI y basis solo existen en el perpetuo real.
        </OfflineNote>
      )}
    </Panel>
  )
}

export default function MercadoPage() {
  const { tickers, source, online, loading } = useTickers()
  const [sym, setSym] = useState<string>('BTC')
  const sourceLabel = source === 'BYBIT' ? `PERPETUO · ${source}` : `referencia · ${source}`

  return (
    <AppShell title="Mercado">
      <div className="mx-auto w-full max-w-[1400px] px-4 lg:px-6 py-5 lg:py-6 space-y-5">
        <div className="flex items-center gap-3">
          <h2 className="text-[20px] font-semibold text-fg tracking-tight">Mercado</h2>
          {online ? (
            <StatusChip tone="ok" label={sourceLabel} />
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

        {/* Perpetuo real del símbolo seleccionado: funding / OI / basis */}
        <PerpPanel sym={sym} />

        {/* Gráfico de velas del símbolo seleccionado */}
        <CandlesChart symbol={sym} defaultTf="1H" defaultInd={['ema20', 'ema50', 'ema200', 'vol', 'rsi']} />

        <Panel title="Nota de fuentes" icon={CandlestickChart} status={<StatusChip tone="warn" label="observación" />}>
          <OfflineNote>
            Las velas y el ticker usan el PERPETUO de Bybit (category=linear) vía el servicio del Hetzner como
            fuente primaria — es el mismo mercado donde opera el motor. Si ese feed no responde, caen a precio de
            REFERENCIA (Coinbase → OKX) y el rótulo lo dice. Funding, open interest y basis existen solo en el
            perpetuo real. NADA de esto envía órdenes: la ejecución sigue apagada por diseño (TRADING_ENABLED=false).
          </OfflineNote>
        </Panel>
      </div>
    </AppShell>
  )
}
