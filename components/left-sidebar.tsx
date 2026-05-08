'use client'

import { motion } from 'framer-motion'
import { MessageCircle, ListChecks, Moon, Settings, X } from 'lucide-react'
import { VoTradingLogo } from './vo-trading-logo'
import { TanitOrb } from './tanit-orb'
import { ThemeToggle } from './theme-toggle'
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
  { href: '/memoria', label: 'Mi Espacio', icon: Moon },
]

export function LeftSidebar({ isOpen = true, onClose, collapsed = false }: LeftSidebarProps) {
  const pathname = usePathname()

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

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4">
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

      {/* Footer with Theme Toggle and Settings */}
      <div className="p-3 border-t border-border space-y-1">
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
