'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { MessageCircle, ListChecks, Moon, Settings, X, Activity } from 'lucide-react'
import { VoTradingLogo } from './vo-trading-logo'
import { TanitOrb } from './tanit-orb'
import { ThemeToggle } from './theme-toggle'
import { ThreadsList } from './threads-list'
import { SystemStatusPanel } from './system-status-panel'
import { useSystemStatus } from '@/hooks/use-system-status'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface LeftSidebarProps {
  isOpen?: boolean
  onClose?: () => void
  collapsed?: boolean
  /** Si true, renderiza la lista de threads encima de la nav. Solo /chat. */
  showThreads?: boolean
  /** Thread activo (para resaltarlo en la lista). */
  activeThreadId?: string | null
  /** Callback cuando el usuario selecciona un thread. */
  onSelectThread?: (threadId: string) => void
}

const navItems = [
  { href: '/chat', label: 'Hablar con Tanit', icon: MessageCircle },
  { href: '/decisions', label: 'Decisiones', icon: ListChecks },
  { href: '/memoria', label: 'Mi Espacio', icon: Moon },
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
      {/* Header */}
      <div className={`p-5 ${collapsed ? 'flex justify-center' : ''}`}>
        {collapsed ? (
          <div className="relative">
            <TanitOrb state="idle" size="xs" />
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <VoTradingLogo size="sm" showTagline={false} />
            {onClose && (
              <button
                onClick={onClose}
                className="p-2 rounded-xl hover:bg-bg-2 transition-all duration-200 lg:hidden"
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
        <div className="flex-1 min-h-0 border-b border-border">
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
      <nav className={`px-3 py-4 ${showThreads && !collapsed ? '' : 'flex-1'}`}>
        <ul className="space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href
            const Icon = item.icon

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onClose}
                  className={`
                    flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 relative overflow-hidden
                    ${collapsed ? 'justify-center' : ''}
                    ${
                      isActive
                        ? 'text-amber'
                        : 'text-fg-2 hover:text-fg hover:bg-bg-2'
                    }
                  `}
                  title={collapsed ? item.label : undefined}
                >
                  {/* Active indicator */}
                  {isActive && (
                    <motion.div
                      layoutId="nav-active"
                      className="absolute inset-0 rounded-xl bg-amber-soft border border-amber/15"
                      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    />
                  )}
                  <Icon 
                    className={`w-5 h-5 flex-shrink-0 relative z-10 ${isActive ? 'text-amber' : ''}`} 
                    strokeWidth={1.5} 
                  />
                  {!collapsed && (
                    <span className="text-[14px] font-medium tracking-body relative z-10">{item.label}</span>
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Footer with Status, Theme Toggle and Settings */}
      <div className="p-3 border-t border-border space-y-1">
        {/* Status del sistema */}
        <button
          onClick={() => setStatusOpen(true)}
          className={`
            flex items-center gap-3 w-full px-3 py-3 rounded-xl relative
            text-fg-2 hover:text-fg hover:bg-bg-2 transition-all duration-200
            ${collapsed ? 'justify-center' : ''}
          `}
          title={collapsed ? 'Estado del sistema' : undefined}
          aria-label="Estado del sistema"
        >
          <span className="relative inline-flex">
            <Activity className="w-5 h-5" strokeWidth={1.5} />
            {/* Dot indicador en la esquina del icono */}
            {!status.loading && (
              <span
                className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full ${statusDotColor} ring-2 ring-bg-1`}
              />
            )}
          </span>
          {!collapsed && (
            <>
              <span className="text-[14px] font-medium tracking-body flex-1 text-left">
                Estado
              </span>
              {!status.loading && (
                <span
                  className={`text-[10px] font-mono uppercase tracking-wider ${
                    !status.reachable
                      ? 'text-error'
                      : status.needsAttention
                        ? 'text-amber'
                        : status.allOk
                          ? 'text-success'
                          : 'text-fg-3'
                  }`}
                >
                  {!status.reachable
                    ? 'caído'
                    : status.needsAttention
                      ? 'revisar'
                      : status.allOk
                        ? 'ok'
                        : '—'}
                </span>
              )}
            </>
          )}
        </button>

        <div className={`flex items-center ${collapsed ? 'justify-center' : 'justify-between'} px-3 py-2`}>
          {!collapsed && <span className="text-[12px] text-fg-3 font-mono uppercase tracking-wider">Tema</span>}
          <ThemeToggle />
        </div>
        <button
          className={`
            flex items-center gap-3 w-full px-3 py-3 rounded-xl
            text-fg-2 hover:text-fg hover:bg-bg-2 transition-all duration-200
            ${collapsed ? 'justify-center' : ''}
          `}
          title={collapsed ? 'Configuracion' : undefined}
        >
          <Settings className="w-5 h-5" strokeWidth={1.5} />
          {!collapsed && <span className="text-[14px] font-medium tracking-body">Configuracion</span>}
        </button>
      </div>

      {/* Modal del estado del sistema */}
      <SystemStatusPanel open={statusOpen} onClose={() => setStatusOpen(false)} />
    </div>
  )

  // Desktop sidebar
  if (!onClose) {
    return (
      <aside
        className={`
          hidden lg:flex flex-col h-full border-r border-border
          bg-bg-1/80 backdrop-blur-xl
          ${collapsed ? 'w-16' : 'w-64'}
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
          className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm z-40 lg:hidden"
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
