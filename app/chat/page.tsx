'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Menu, LineChart } from 'lucide-react'
import { LeftSidebar } from '@/components/left-sidebar'
import { ChatPanel } from '@/components/chat-panel'
import { useThreads } from '@/hooks/use-threads'
import { LiveSidebar } from '@/components/live-sidebar'
import { StatusBar } from '@/components/status-bar'
import { LiveStatusBar } from '@/components/live-status-bar'

export default function ChatPage() {
  const [leftDrawerOpen, setLeftDrawerOpen] = useState(false)
  const [rightDrawerOpen, setRightDrawerOpen] = useState(false)
  const { activeThreadId, setActiveThreadId } = useThreads('luis')

  return (
    <div className="h-screen flex flex-col bg-bg overflow-hidden relative">
      {/* Subtle ambient background for light mode, stronger for dark */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Top center ambient glow */}
        <div 
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] opacity-10 dark:opacity-20"
          style={{
            background: 'radial-gradient(ellipse at center top, var(--amber-glow) 0%, transparent 60%)',
            filter: 'blur(80px)',
          }}
        />
        {/* Bottom right subtle glow */}
        <div 
          className="absolute bottom-0 right-0 w-[600px] h-[400px] opacity-5 dark:opacity-10"
          style={{
            background: 'radial-gradient(ellipse at bottom right, var(--amber-glow) 0%, transparent 60%)',
            filter: 'blur(60px)',
          }}
        />
      </div>

      {/* Mobile Header */}
      <div className="lg:hidden h-14 flex items-center justify-between px-4 border-b border-border bg-bg/80 backdrop-blur-xl relative z-30">
        <motion.button
          onClick={() => setLeftDrawerOpen(true)}
          className="w-11 h-11 rounded-xl flex items-center justify-center border border-border bg-bg-1"
          whileTap={{ scale: 0.95 }}
          aria-label="Abrir menu"
        >
          <Menu className="w-5 h-5 text-fg-1" />
        </motion.button>
        
        {/* Center logo hint */}
        <div className="flex items-center gap-2">
          <div 
            className="w-5 h-5 rounded-full border-2 border-amber"
            style={{
              boxShadow: '0 0 12px var(--amber-glow), inset 0 0 6px var(--amber-soft)',
            }}
          />
          <span className="text-[14px] font-semibold text-fg tracking-[-0.02em]">V Trading</span>
        </div>
        
        <motion.button
          onClick={() => setRightDrawerOpen(true)}
          className="w-11 h-11 rounded-xl flex items-center justify-center bg-amber-soft border border-amber/20"
          whileTap={{ scale: 0.95 }}
          aria-label="Abrir panel en vivo"
        >
          <LineChart className="w-5 h-5 text-amber" />
        </motion.button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden relative z-10">
        {/* Desktop Left Sidebar with threads list */}
        <LeftSidebar
          showThreads
          activeThreadId={activeThreadId}
          onSelectThread={setActiveThreadId}
        />

        {/* Tablet Left Sidebar (icons only) */}
        <div className="hidden md:flex lg:hidden">
          <LeftSidebar collapsed />
        </div>

        {/* Chat Panel */}
        <main className="flex-1 min-w-0 flex flex-col overflow-hidden">
          <ChatPanel threadId={activeThreadId} />
        </main>

        {/* Desktop Right Sidebar */}
        <LiveSidebar />
      </div>

      {/* Status Bar — datos reales vía useLiveStatus */}
      <LiveStatusBar />

      {/* Mobile Left Drawer with threads list */}
      <AnimatePresence>
        {leftDrawerOpen && (
          <LeftSidebar
            isOpen={leftDrawerOpen}
            onClose={() => setLeftDrawerOpen(false)}
            showThreads
            activeThreadId={activeThreadId}
            onSelectThread={setActiveThreadId}
          />
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
