'use client'

import { motion } from 'framer-motion'
import { MessageCircle, ListChecks, Brain, Settings, X } from 'lucide-react'
import { VoTradingLogo } from './vo-trading-logo'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface LeftSidebarProps {
  isOpen?: boolean
  onClose?: () => void
  collapsed?: boolean
}

const navItems = [
  { href: '/chat', label: 'Hablar con Tanit', icon: MessageCircle },
  { href: '/decisions', label: 'Decisiones', icon: ListChecks },
  { href: '/memoria', label: 'Memoria', icon: Brain },
]

export function LeftSidebar({ isOpen = true, onClose, collapsed = false }: LeftSidebarProps) {
  const pathname = usePathname()

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className={`p-4 ${collapsed ? 'flex justify-center' : ''}`}>
        {collapsed ? (
          <div className="w-8 h-8 rounded-full border-2 border-amber amber-glow-sm" />
        ) : (
          <div className="flex items-center justify-between">
            <VoTradingLogo size="sm" showTagline={false} />
            {onClose && (
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-bg-elev transition-colors lg:hidden"
                aria-label="Cerrar menu"
              >
                <X className="w-5 h-5 text-fg-2" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-4">
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
                    flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200
                    ${collapsed ? 'justify-center' : ''}
                    ${
                      isActive
                        ? 'bg-amber-soft text-amber'
                        : 'text-fg-2 hover:text-fg hover:bg-bg-elev'
                    }
                  `}
                  title={collapsed ? item.label : undefined}
                >
                  <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-amber' : ''}`} />
                  {!collapsed && (
                    <span className="text-sm font-medium tracking-body">{item.label}</span>
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Settings */}
      <div className="p-2 border-t border-glass-border">
        <button
          className={`
            flex items-center gap-3 w-full px-3 py-2.5 rounded-lg
            text-fg-2 hover:text-fg hover:bg-bg-elev transition-colors
            ${collapsed ? 'justify-center' : ''}
          `}
          title={collapsed ? 'Configuracion' : undefined}
        >
          <Settings className="w-5 h-5" />
          {!collapsed && <span className="text-sm font-medium tracking-body">Configuracion</span>}
        </button>
      </div>
    </div>
  )

  // Desktop sidebar
  if (!onClose) {
    return (
      <aside
        className={`
          hidden lg:flex flex-col h-full glass border-r border-glass-border
          ${collapsed ? 'w-16' : 'w-60'}
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
      {/* Backdrop */}
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Drawer */}
      <motion.aside
        initial={{ x: '-100%' }}
        animate={{ x: isOpen ? 0 : '-100%' }}
        transition={{ type: 'spring', stiffness: 280, damping: 30 }}
        className="fixed top-0 left-0 h-full w-72 glass border-r border-glass-border z-50 lg:hidden"
      >
        {sidebarContent}
      </motion.aside>
    </>
  )
}
