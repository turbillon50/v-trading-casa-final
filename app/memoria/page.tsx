'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Menu, LineChart, Brain, MessageCircle, User } from 'lucide-react'
import { LeftSidebar } from '@/components/left-sidebar'
import { LiveSidebar } from '@/components/live-sidebar'
import { StatusBar } from '@/components/status-bar'

interface Memory {
  id: string
  type: 'personal' | 'tanit' | 'chat'
  title: string
  content: string
  timestamp: Date
}

const mockMemories: Memory[] = [
  {
    id: '1',
    type: 'personal',
    title: 'Perfil de riesgo',
    content: 'Luis prefiere operaciones conservadoras con maximo 5x de apalancamiento. Evita operar durante alta volatilidad de noticias.',
    timestamp: new Date(Date.now() - 86400000 * 7),
  },
  {
    id: '2',
    type: 'personal',
    title: 'Horario preferido',
    content: 'Opera principalmente entre 9am-12pm y 8pm-11pm hora Mexico. Evita sesion asiatica.',
    timestamp: new Date(Date.now() - 86400000 * 5),
  },
  {
    id: '3',
    type: 'tanit',
    title: 'Patron identificado',
    content: 'Luis tiene mejor desempeno en operaciones de continuacion de tendencia que en reversiones. Exito 72% vs 45%.',
    timestamp: new Date(Date.now() - 86400000 * 2),
  },
  {
    id: '4',
    type: 'tanit',
    title: 'Observacion de mercado',
    content: 'BTC muestra acumulacion en zona $65k-$68k. Breakout probable si mantiene soporte de 4H.',
    timestamp: new Date(Date.now() - 3600000 * 6),
  },
  {
    id: '5',
    type: 'chat',
    title: 'Conversacion destacada',
    content: 'Discusion sobre estrategia de grid trading para mercados laterales. Luis interesado en automatizar.',
    timestamp: new Date(Date.now() - 86400000),
  },
]

function MemoryCard({ memory }: { memory: Memory }) {
  const typeConfig = {
    personal: { icon: User, color: 'bg-amber-soft text-amber', label: 'Personal' },
    tanit: { icon: Brain, color: 'bg-success/20 text-success', label: 'Tanit' },
    chat: { icon: MessageCircle, color: 'bg-fg-3/20 text-fg-2', label: 'Chat' },
  }

  const config = typeConfig[memory.type]
  const Icon = config.icon

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="glass rounded-xl p-4 h-full flex flex-col"
    >
      <div className="flex items-center gap-2 mb-3">
        <div className={`w-7 h-7 rounded-lg ${config.color} flex items-center justify-center`}>
          <Icon className="w-4 h-4" />
        </div>
        <span className="text-[10px] uppercase tracking-wider text-fg-3">{config.label}</span>
      </div>
      <h3 className="text-sm font-medium text-fg mb-2">{memory.title}</h3>
      <p className="text-xs text-fg-1 flex-1">{memory.content}</p>
      <span className="text-[10px] font-mono text-fg-3 mt-3">
        {memory.timestamp.toLocaleDateString('es-MX', {
          day: 'numeric',
          month: 'short',
        })}
      </span>
    </motion.div>
  )
}

export default function MemoriaPage() {
  const [leftDrawerOpen, setLeftDrawerOpen] = useState(false)
  const [rightDrawerOpen, setRightDrawerOpen] = useState(false)

  const stats = {
    personal: mockMemories.filter((m) => m.type === 'personal').length,
    tanit: mockMemories.filter((m) => m.type === 'tanit').length,
    chats: 3809,
  }

  return (
    <div className="h-screen flex flex-col bg-bg overflow-hidden">
      {/* Mobile Header */}
      <div className="lg:hidden h-14 flex items-center justify-between px-4 border-b border-glass-border">
        <button
          onClick={() => setLeftDrawerOpen(true)}
          className="w-10 h-10 rounded-lg glass flex items-center justify-center"
          aria-label="Abrir menu"
        >
          <Menu className="w-5 h-5 text-fg" />
        </button>
        <span className="text-sm font-semibold text-fg tracking-tight-custom">Memoria</span>
        <button
          onClick={() => setRightDrawerOpen(true)}
          className="w-10 h-10 rounded-lg glass border border-amber/30 flex items-center justify-center"
          aria-label="Abrir panel en vivo"
        >
          <LineChart className="w-5 h-5 text-amber" />
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        <LeftSidebar />
        <div className="hidden md:flex lg:hidden">
          <LeftSidebar collapsed />
        </div>

        <main className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 lg:p-6">
            <div className="max-w-4xl mx-auto">
              <h1 className="text-2xl font-semibold text-fg tracking-tight-custom mb-2">
                Memoria
              </h1>
              <p className="text-sm text-fg-2 mb-6">
                {stats.personal + stats.tanit} memorias · {stats.chats} conversaciones
              </p>

              {/* Stats row */}
              <div className="grid grid-cols-3 gap-3 mb-6">
                <div className="glass rounded-xl p-4 text-center">
                  <span className="text-2xl font-semibold font-mono tabular-nums text-fg">{stats.personal}</span>
                  <span className="text-xs text-fg-2 block mt-1">Personales</span>
                </div>
                <div className="glass rounded-xl p-4 text-center">
                  <span className="text-2xl font-semibold font-mono tabular-nums text-fg">{stats.tanit}</span>
                  <span className="text-xs text-fg-2 block mt-1">De Tanit</span>
                </div>
                <div className="glass rounded-xl p-4 text-center">
                  <span className="text-2xl font-semibold font-mono tabular-nums text-fg">{stats.chats}</span>
                  <span className="text-xs text-fg-2 block mt-1">Chats</span>
                </div>
              </div>

              {/* Memory grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {mockMemories.map((memory) => (
                  <MemoryCard key={memory.id} memory={memory} />
                ))}
              </div>
            </div>
          </div>
        </main>

        <LiveSidebar />
      </div>

      <StatusBar />

      <AnimatePresence>
        {leftDrawerOpen && (
          <LeftSidebar isOpen={leftDrawerOpen} onClose={() => setLeftDrawerOpen(false)} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {rightDrawerOpen && (
          <LiveSidebar isOpen={rightDrawerOpen} onClose={() => setRightDrawerOpen(false)} />
        )}
      </AnimatePresence>
    </div>
  )
}
