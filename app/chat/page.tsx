'use client'

import { useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { Menu, LineChart } from 'lucide-react'
import { LeftSidebar } from '@/components/left-sidebar'
import { ChatPanel } from '@/components/chat-panel'
import { LiveSidebar } from '@/components/live-sidebar'
import { StatusBar } from '@/components/status-bar'

export default function ChatPage() {
  const [leftDrawerOpen, setLeftDrawerOpen] = useState(false)
  const [rightDrawerOpen, setRightDrawerOpen] = useState(false)

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
        <span className="text-sm font-semibold text-fg tracking-tight-custom">V Trading</span>
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
        {/* Desktop Left Sidebar */}
        <LeftSidebar />

        {/* Tablet Left Sidebar (icons only) */}
        <div className="hidden md:flex lg:hidden">
          <LeftSidebar collapsed />
        </div>

        {/* Chat Panel */}
        <main className="flex-1 flex flex-col overflow-hidden">
          <ChatPanel />
        </main>

        {/* Desktop Right Sidebar */}
        <LiveSidebar />
      </div>

      {/* Status Bar */}
      <StatusBar
        tanitOnline={true}
        bybitLive={true}
        memoryCount={76}
        chatCount={3809}
        positionsCount={2}
        pnl={1.47}
        haltActive={false}
      />

      {/* Mobile Left Drawer */}
      <AnimatePresence>
        {leftDrawerOpen && (
          <LeftSidebar isOpen={leftDrawerOpen} onClose={() => setLeftDrawerOpen(false)} />
        )}
      </AnimatePresence>

      {/* Mobile Right Drawer */}
      <AnimatePresence>
        {rightDrawerOpen && (
          <LiveSidebar isOpen={rightDrawerOpen} onClose={() => setRightDrawerOpen(false)} />
        )}
      </AnimatePresence>
    </div>
  )
}
