'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  MessageSquare,
  CandlestickChart,
  Layers,
  ListChecks,
  BookMarked,
  SlidersHorizontal,
  X,
  Activity,
} from 'lucide-react'
import { VoTradingLogo, VTradingSeal } from './vo-trading-logo'
import { ThemeToggle } from './theme-toggle'
import { ThreadsList } from './threads-list'
import { SystemStatusPanel } from './system-status-panel'
import { ModeBadge } from './mode-badge'
import { useSystemStatus } from '@/hooks/use-system-status'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface LeftSidebarProps {
  isOpen?: boolean
  onClose?: () => void
  collapsed?: boolean
  /** Si true, renderiza la lista de threads encima de la nav. Solo /chat. */
  showThreads?: boolean
  activeThreadId?: string | null
  onSelectThread?: (threadId: string) => void
}

/** 6 destinos (contrato). Chat = punto de entrada = Command Center en `/`. */
const navItems = [
  { href: '/', label: 'Chat', icon: MessageSquare, match: (p: string) => p === '/' || p.startsWith('/chat') },
  { href: '/mercado', label: 'Mercado', icon: CandlestickChart, match: (p: string) => p.startsWith('/mercado') },
  { href: '/posiciones', label: 'Posiciones', icon: Layers, match: (p: string) => p.startsWith('/posiciones') },
  { href: '/decisions', label: 'Decisiones', icon: ListChecks, match: (p: string) => p.startsWith('/decision') },
  { href: '/memoria', label: 'Memoria', icon: BookMarked, match: (p: string) => p.startsWith('/memoria') },
  { href: '/sistema', label: 'Sistema', icon: SlidersHorizontal, match: (p: string) => p.startsWith('/sistema') },
]

export function LeftSidebar({
  isOpen = true,
  onClose,
  collapsed = false,
  showThreads = false,
  activeThreadId = null,
  onSelectThread,
}: LeftSidebarProps) {
  const pathname = usePathname()
  const [statusOpen, setStatusOpen] = useState(false)
  const status = useSystemStatus()
  const statusDotColor = !status.reachable
    ? 'bg-error'
    : status.needsAttention
      ? 'bg-amber'
      : status.allOk
        ? 'bg-success'
        : 'bg-fg-3'

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Header — sello + wordmark */}
      <div className={`px-4 py-5 ${collapsed ? 'flex justify-center' : ''}`}>
        {collapsed ? (
          <VTradingSeal size={30} />
        ) : (
          <div className="flex items-center justify-between">
            <Link href="/" onClick={onClose} aria-label="V-TRADING — Command Center">
              <VoTradingLogo size="sm" />
            </Link>
            {onClose && (
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-bg-2 transition-colors lg:hidden"
                aria-label="Cerrar menu"
              >
                <X className="w-5 h-5 text-fg-2" strokeWidth={1.5} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* ThreadsList — solo en /chat cuando no collapsed */}
      {showThreads && !collapsed && onSelectThread && (
        <div className="flex-1 min-h-0 border-y border-border">
          <ThreadsList
            activeThreadId={activeThreadId}
            onSelect={(id) => {
              onSelectThread(id)
              onClose?.()
            }}
          />
        </div>
      )}

      {/* Navigation */}
      <nav className={`px-3 py-3 ${showThreads && !collapsed ? '' : 'flex-1'}`}>
        <ul className="space-y-0.5">
          {navItems.map((item) => {
            const isActive = item.match(pathname)
            const Icon = item.icon
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onClose}
                  className={`
                    flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors duration-200 relative
                    ${collapsed ? 'justify-center' : ''}
                    ${isActive ? 'text-amber' : 'text-fg-2 hover:text-fg hover:bg-bg-2'}
                  `}
                  title={collapsed ? item.label : undefined}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {isActive && (
                    <motion.div
                      layoutId="nav-active"
                      className="absolute inset-0 rounded-lg bg-amber-soft border border-amber/20"
                      transition={{ type: 'spring', stiffness: 320, damping: 30 }}
                    />
                  )}
                  <Icon className="w-[18px] h-[18px] flex-shrink-0 relative z-10" strokeWidth={isActive ? 2 : 1.5} />
                  {!collapsed && (
                    <span className="text-[13.5px] font-medium tracking-body relative z-10">{item.label}</span>
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Footer — modo + estado + tema */}
      <div className="p-3 border-t border-border space-y-1">
        {!collapsed && (
          <div className="px-1 pb-2">
            <ModeBadge />
          </div>
        )}
        <button
          onClick={() => setStatusOpen(true)}
          className={`
            flex items-center gap-3 w-full px-3 py-2.5 rounded-lg relative
            text-fg-2 hover:text-fg hover:bg-bg-2 transition-colors duration-200
            ${collapsed ? 'justify-center' : ''}
          `}
          title={collapsed ? 'Estado del sistema' : undefined}
          aria-label="Estado del sistema"
        >
          <span className="relative inline-flex">
            <Activity className="w-[18px] h-[18px]" strokeWidth={1.5} />
            {!status.loading && (
              <span className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full ${statusDotColor} ring-2 ring-bg-1`} />
            )}
          </span>
          {!collapsed && (
            <>
              <span className="text-[13.5px] font-medium tracking-body flex-1 text-left">Estado</span>
              {!status.loading && (
                <span
                  className={`text-[10px] font-mono uppercase tracking-wider ${
                    !status.reachable ? 'text-error' : status.needsAttention ? 'text-amber' : status.allOk ? 'text-success' : 'text-fg-3'
                  }`}
                >
                  {!status.reachable ? 'offline' : status.needsAttention ? 'revisar' : status.allOk ? 'ok' : '—'}
                </span>
              )}
            </>
          )}
        </button>

        <div className={`flex items-center ${collapsed ? 'justify-center' : 'justify-between'} px-3 py-1.5`}>
          {!collapsed && <span className="text-[11px] text-fg-3 font-mono uppercase tracking-wider">Tema</span>}
          <ThemeToggle />
        </div>
      </div>

      <SystemStatusPanel open={statusOpen} onClose={() => setStatusOpen(false)} />
    </div>
  )

  // Desktop sidebar
  if (!onClose) {
    return (
      <aside
        className={`
          hidden lg:flex flex-col h-full border-r border-border bg-bg-1/60 backdrop-blur-xl
          ${collapsed ? 'w-16' : 'w-[208px]'}
          transition-all duration-300
        `}
      >
        {sidebarContent}
      </aside>
    )
  }

  // Mobile drawer
  return (
    <>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
        />
      )}
      <motion.aside
        initial={{ x: '-100%' }}
        animate={{ x: isOpen ? 0 : '-100%' }}
        exit={{ x: '-100%' }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="fixed top-0 left-0 h-full w-72 z-50 lg:hidden border-r border-border bg-bg/95 backdrop-blur-xl"
      >
        {sidebarContent}
      </motion.aside>
    </>
  )
}
