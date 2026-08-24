'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import { MessageSquare, CandlestickChart, Layers, ListChecks, SlidersHorizontal } from 'lucide-react'

const items = [
  { href: '/', label: 'Chat', icon: MessageSquare, match: (p: string) => p === '/' },
  { href: '/mercado', label: 'Mercado', icon: CandlestickChart, match: (p: string) => p.startsWith('/mercado') },
  { href: '/posiciones', label: 'Posiciones', icon: Layers, match: (p: string) => p.startsWith('/posiciones') },
  { href: '/decisions', label: 'Decisiones', icon: ListChecks, match: (p: string) => p.startsWith('/decision') },
  { href: '/sistema', label: 'Sistema', icon: SlidersHorizontal, match: (p: string) => p.startsWith('/sistema') },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border pb-safe crystal-panel"
      style={{ borderRadius: 0, backdropFilter: 'blur(12px)', background: 'rgba(0,0,0,.85)' }}
      aria-label="Navegación principal"
    >
      <ul className="grid grid-cols-5 h-14">
        {items.map((item) => {
          const active = item.match(pathname)
          const Icon = item.icon
          return (
            <li key={item.href} className="relative">
              <Link
                href={item.href}
                className={`flex flex-col items-center justify-center gap-1 h-full min-h-[44px] transition-colors duration-150 ${
                  active ? 'text-rose' : 'text-fg-3 active:text-fg-2'
                }`}
                aria-current={active ? 'page' : undefined}
              >
                {active && (
                  <motion.span
                    layoutId="bottomnav-active"
                    className="absolute top-0 h-0.5 w-8 rounded-full bg-rose"
                    style={{ boxShadow: '0 0 8px rgba(255,45,135,.6)' }}
                    transition={{ type: 'spring', stiffness: 320, damping: 30 }}
                  />
                )}
                <Icon className="w-[22px] h-[22px]" strokeWidth={active ? 2 : 1.5} />
                <span className="text-[10px] font-medium tracking-tight leading-none">{item.label}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
