'use client'

import { useState, type ReactNode } from 'react'
import { AnimatePresence } from 'framer-motion'
import { Menu, Bell, Eye } from 'lucide-react'
import { LeftSidebar } from './left-sidebar'
import { BottomNav } from './bottom-nav'
import { MarketTicker } from './market-ticker'
import { ModeBadge } from './mode-badge'
import { VoTradingLogo } from './vo-trading-logo'

/**
 * Shell de las rutas del centro de operaciones (Command Center, Mercado,
 * Posiciones, Sistema, Decisiones, Memoria). Composición específica por
 * tamaño: en desktop sidebar fija + header operativo con ticker; en móvil
 * header compacto + bottom nav exclusiva. Sin bottom tabbar en desktop.
 */
export function AppShell({
  children,
  title,
}: {
  children: ReactNode
  title?: string
}) {
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <div className="h-[100dvh] flex flex-col bg-bg overflow-hidden">
      {/* Header móvil */}
      <header className="lg:hidden flex items-center justify-between h-14 px-3 border-b border-border bg-bg/85 backdrop-blur-xl relative z-30 pt-safe">
        <button
          onClick={() => setDrawerOpen(true)}
          className="w-11 h-11 flex items-center justify-center rounded-lg hover:bg-bg-2 active:scale-95 transition"
          aria-label="Abrir menú"
        >
          <Menu className="w-5 h-5 text-fg-2" strokeWidth={1.5} />
        </button>
        <VoTradingLogo size="sm" />
        <div className="flex items-center justify-end min-w-[44px]">
          <span
            className="vt-mode-badge font-mono !px-2 !text-[10px]"
            title="V-TRADING observa el mercado; no ejecuta órdenes de forma autónoma."
          >
            <Eye className="w-3 h-3" strokeWidth={2} /> Observación
          </span>
        </div>
      </header>

      <div className="flex-1 flex min-h-0 relative z-10">
        {/* Sidebar desktop */}
        <LeftSidebar />
        {/* Sidebar tablet (iconos) */}
        <div className="hidden md:flex lg:hidden">
          <LeftSidebar collapsed />
        </div>

        <main className="flex-1 min-w-0 flex flex-col overflow-hidden">
          {/* Header operativo desktop */}
          <div className="hidden lg:flex items-center justify-between h-14 px-6 border-b border-border bg-bg/60 backdrop-blur-xl flex-shrink-0">
            <div className="flex items-center gap-6 min-w-0">
              {title && <h1 className="text-[15px] font-semibold text-fg tracking-tight flex-shrink-0">{title}</h1>}
              <div className="h-5 w-px bg-border flex-shrink-0" />
              <MarketTicker />
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              <ModeBadge />
              <button
                className="w-9 h-9 flex items-center justify-center rounded-lg border border-border text-fg-3 hover:text-fg hover:bg-bg-2 transition"
                aria-label="Notificaciones"
              >
                <Bell className="w-[18px] h-[18px]" strokeWidth={1.5} />
              </button>
            </div>
          </div>

          {/* Contenido scrolleable */}
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <div className="mb-safe-nav lg:mb-0">{children}</div>
          </div>
        </main>
      </div>

      <BottomNav />

      <AnimatePresence>
        {drawerOpen && <LeftSidebar isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} />}
      </AnimatePresence>
    </div>
  )
}
