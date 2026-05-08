'use client'

import { StatusBar } from './status-bar'
import { useLiveStatus } from '@/hooks/use-live-status'

/**
 * Wrapper de <StatusBar /> que carga estado real cada 5s vía useLiveStatus.
 * Las páginas (chat, decisions, memoria) usan ESTE componente — no el
 * StatusBar puro con props mock.
 */
export function LiveStatusBar() {
  const s = useLiveStatus()
  return (
    <StatusBar
      tanitOnline={s.tanitOnline}
      bybitLive={s.bybitLive}
      memoryCount={s.memoryCount}
      chatCount={s.chatCount}
      positionsCount={s.positionsCount}
      equity={s.equity}
      pnl={s.pnl}
      haltActive={s.haltActive}
      testnet={s.testnet}
    />
  )
}
