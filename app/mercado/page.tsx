'use client'

import { useEffect, useState } from 'react'
import { CandlestickChart, TrendingUp } from 'lucide-react'
import { AppShell } from '@/components/app-shell'
import { Panel, StatusChip, OfflineNote, DataRow } from '@/components/vt-primitives'
import { api } from '@/lib/api'

const SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'] as const
type Sym = (typeof SYMBOLS)[number]

interface Tick {
  symbol: Sym
  price: number | null
  change: number | null
  high: number | null
  low: number | null
  vol: number | null
  online: boolean
  loading: boolean
}

function SymbolCard({ t }: { t: Tick }) {
  const pos = (t.change ?? 0) >= 0
  return (
    <Panel
      title={`${t.symbol.replace('USDT', '')}/USDT`}
      icon={CandlestickChart}
      status={t.online ? <StatusChip tone="ok" label="en vivo" /> : <StatusChip tone="offline" label="offline" />}
    >
      <div className="flex items-baseline gap-2">
        <span className="text-[24px] font-semibold font-mono nums text-fg">
          {t.price != null ? t.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
        </span>
        {t.change != null ? (
          <span className={`text-[13px] font-mono nums ${pos ? 'text-success' : 'text-error'}`}>
            {pos ? '+' : ''}
            {t.change.toFixed(2)}%
          </span>
        ) : (
          <span className="text-[12px] font-mono text-fg-3">sin datos</span>
        )}
      </div>
      <div className="mt-3 pt-3 border-t border-border">
        <DataRow label="Máx. 24H" value={t.high != null ? t.high.toLocaleString('en-US', { maximumFractionDigits: 2 }) : '—'} />
        <DataRow label="Mín. 24H" value={t.low != null ? t.low.toLocaleString('en-US', { maximumFractionDigits: 2 }) : '—'} />
        <DataRow label="Volumen 24H" value={t.vol != null ? t.vol.toLocaleString('en-US', { maximumFractionDigits: 0 }) : '—'} />
      </div>
      {!t.online && !t.loading && (
        <div className="mt-3">
          <OfflineNote>Precio no disponible: el feed de mercado llega por el motor, apagado por diseño.</OfflineNote>
        </div>
      )}
    </Panel>
  )
}

export default function MercadoPage() {
  const [ticks, setTicks] = useState<Tick[]>(() =>
    SYMBOLS.map((s) => ({ symbol: s, price: null, change: null, high: null, low: null, vol: null, online: false, loading: true })),
  )

  useEffect(() => {
    let mounted = true
    async function load() {
      const results = await Promise.all(
        SYMBOLS.map(async (s): Promise<Tick> => {
          try {
            const t = await api.ticker(s)
            return {
              symbol: s,
              price: t.price ?? null,
              change: t.changePercent24h ?? null,
              high: t.high24h ?? null,
              low: t.low24h ?? null,
              vol: t.volume24h ?? null,
              online: t.price != null,
              loading: false,
            }
          } catch {
            return { symbol: s, price: null, change: null, high: null, low: null, vol: null, online: false, loading: false }
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

  const anyOnline = ticks.some((t) => t.online)

  return (
    <AppShell title="Mercado">
      <div className="mx-auto w-full max-w-[1400px] px-4 lg:px-6 py-5 lg:py-6 space-y-5">
        <div className="flex items-center gap-3">
          <h2 className="text-[20px] font-semibold text-fg tracking-tight">Mercado</h2>
          {anyOnline ? <StatusChip tone="ok" label="datos en vivo" /> : <StatusChip tone="offline" label="feed offline" />}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {ticks.map((t) => (
            <SymbolCard key={t.symbol} t={t} />
          ))}
        </div>

        <Panel title="Contexto de mercado" icon={TrendingUp} status={<StatusChip tone="offline" label="sin datos" />}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {['Dominio BTC', 'Funding promedio', 'Interés abierto', 'Índice de miedo'].map((k) => (
              <div key={k}>
                <div className="text-[11px] text-fg-3">{k}</div>
                <div className="text-[16px] font-mono nums text-fg-3 mt-0.5">—</div>
              </div>
            ))}
          </div>
          <div className="mt-4">
            <OfflineNote>
              El contexto de mercado (dominancia, funding, interés abierto) se calcula en el motor. Con el motor apagado
              se muestra vacío en lugar de números inventados.
            </OfflineNote>
          </div>
        </Panel>
      </div>
    </AppShell>
  )
}
