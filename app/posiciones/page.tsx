'use client'

import { useEffect, useState } from 'react'
import { Layers } from 'lucide-react'
import { AppShell } from '@/components/app-shell'
import { Panel, StatusChip, OfflineNote } from '@/components/vt-primitives'
import { api, type PortfolioPosition } from '@/lib/api'

export default function PosicionesPage() {
  const [positions, setPositions] = useState<PortfolioPosition[]>([])
  const [loading, setLoading] = useState(true)
  const [online, setOnline] = useState(false)

  useEffect(() => {
    let mounted = true
    async function load() {
      try {
        const r = await api.positions()
        if (!mounted) return
        setPositions(r ?? [])
        setOnline(true)
      } catch {
        if (!mounted) return
        setOnline(false)
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    const id = setInterval(load, 8000)
    return () => {
      mounted = false
      clearInterval(id)
    }
  }, [])

  return (
    <AppShell title="Posiciones">
      <div className="mx-auto w-full max-w-[1400px] px-4 lg:px-6 py-5 lg:py-6 space-y-5">
        <div className="flex items-center gap-3">
          <h2 className="text-[20px] font-semibold text-fg tracking-tight">Posiciones</h2>
          {loading ? (
            <StatusChip tone="neutral" label="…" />
          ) : online ? (
            <StatusChip tone="ok" label={`${positions.length} abiertas`} />
          ) : (
            <StatusChip tone="offline" label="motor offline" />
          )}
        </div>

        {/* Resumen */}
        <div className="grid grid-cols-3 gap-4">
          {[
            ['Total posiciones', online ? String(positions.length) : '—'],
            ['Exposición neta', '—'],
            ['PNL no realizado', '—'],
          ].map(([k, v]) => (
            <div key={k} className="vt-panel-2 p-3.5">
              <div className="text-[11px] text-fg-3">{k}</div>
              <div className="text-[18px] font-mono nums text-fg mt-0.5">{v}</div>
            </div>
          ))}
        </div>

        <Panel
          title="Posiciones abiertas"
          icon={Layers}
          status={online ? <StatusChip tone="ok" label="en vivo" /> : <StatusChip tone="offline" label="offline" />}
        >
          {positions.length === 0 ? (
            <div className="py-6 text-center">
              <div className="mx-auto w-11 h-11 rounded-full border border-border flex items-center justify-center mb-3">
                <Layers className="w-5 h-5 text-fg-3" strokeWidth={1.4} />
              </div>
              <div className="text-[13px] font-medium text-fg-2 mb-1">
                {loading ? 'Cargando…' : 'Sin posiciones abiertas'}
              </div>
              <div className="max-w-[380px] mx-auto">
                <OfflineNote>
                  {online
                    ? 'No hay posiciones abiertas en este momento.'
                    : 'El motor está apagado por diseño: no hay posiciones ni datos que mostrar. Cuando reconecte, la tabla se llena con posiciones reales.'}
                </OfflineNote>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-4">
              <table className="w-full min-w-[640px] text-[12.5px]">
                <thead>
                  <tr className="text-[10px] font-mono uppercase tracking-wider text-fg-3 border-b border-border">
                    <th className="text-left font-medium px-4 py-2">Símbolo</th>
                    <th className="text-left font-medium px-2 py-2">Lado</th>
                    <th className="text-right font-medium px-2 py-2">Tamaño</th>
                    <th className="text-right font-medium px-2 py-2">Entrada</th>
                    <th className="text-right font-medium px-2 py-2">Mark</th>
                    <th className="text-right font-medium px-2 py-2">PNL</th>
                    <th className="text-right font-medium px-4 py-2">Liq.</th>
                  </tr>
                </thead>
                <tbody>
                  {positions.map((p) => {
                    const long = p.side === 'Buy'
                    const pnl = p.unrealizedPnl ?? 0
                    return (
                      <tr key={p.symbol + p.side} className="border-b border-border/60 hover:bg-bg-2/50">
                        <td className="px-4 py-2.5 font-mono text-fg">{p.symbol.replace('USDT', '')}</td>
                        <td className={`px-2 py-2.5 font-mono ${long ? 'text-success' : 'text-error'}`}>
                          {long ? 'LONG' : 'SHORT'} {Math.round(p.leverage)}x
                        </td>
                        <td className="px-2 py-2.5 text-right font-mono nums text-fg">{p.size}</td>
                        <td className="px-2 py-2.5 text-right font-mono nums text-fg-2">{p.entryPrice.toFixed(2)}</td>
                        <td className="px-2 py-2.5 text-right font-mono nums text-fg-2">{p.markPrice.toFixed(2)}</td>
                        <td className={`px-2 py-2.5 text-right font-mono nums ${pnl >= 0 ? 'text-success' : 'text-error'}`}>
                          {pnl >= 0 ? '+' : ''}
                          {pnl.toFixed(2)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono nums text-rose">{p.liquidationPrice.toFixed(2)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
    </AppShell>
  )
}
