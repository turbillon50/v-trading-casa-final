'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Menu, LineChart } from 'lucide-react'
import { LeftSidebar } from '@/components/left-sidebar'
import { ChatPanel } from '@/components/chat-panel'
import { LiveSidebar } from '@/components/live-sidebar'
import { StatusBar } from '@/components/status-bar'

export default function ChatPage() {
  const [leftDrawerOpen, setLeftDrawerOpen] = useState(false)
  const [rightDrawerOpen, setRightDrawerOpen] = useState(false)

  return (
    <div className="h-screen flex flex-col bg-black overflow-hidden relative">
      {/* Cinematic ambient background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Top center ambient glow */}
        <div 
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] opacity-20"
          style={{
            background: 'radial-gradient(ellipse at center top, rgba(245,166,35,0.15) 0%, transparent 60%)',
            filter: 'blur(80px)',
          }}
        />
        {/* Bottom right subtle glow */}
        <div 
          className="absolute bottom-0 right-0 w-[600px] h-[400px] opacity-10"
          style={{
            background: 'radial-gradient(ellipse at bottom right, rgba(245,166,35,0.12) 0%, transparent 60%)',
            filter: 'blur(60px)',
          }}
        />
        {/* Noise texture overlay */}
        <div 
          className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          }}
        />
      </div>

      {/* Mobile Header */}
      <div className="lg:hidden h-14 flex items-center justify-between px-4 border-b border-[#101010] bg-black/80 backdrop-blur-xl relative z-30">
        <motion.button
          onClick={() => setLeftDrawerOpen(true)}
          className="w-11 h-11 rounded-xl flex items-center justify-center border border-[#1a1a1a] bg-[#0a0a0a]"
          whileTap={{ scale: 0.95 }}
          aria-label="Abrir menu"
        >
          <Menu className="w-5 h-5 text-[#a1a1a1]" />
        </motion.button>
        
        {/* Center logo hint */}
        <div className="flex items-center gap-2">
          <div 
            className="w-5 h-5 rounded-full border-2 border-[#F5A623]"
            style={{
              boxShadow: '0 0 12px rgba(245,166,35,0.4), inset 0 0 6px rgba(245,166,35,0.2)',
            }}
          />
          <span className="text-[14px] font-semibold text-[#fafafa] tracking-[-0.02em]">V Trading</span>
        </div>
        
        <motion.button
          onClick={() => setRightDrawerOpen(true)}
          className="w-11 h-11 rounded-xl flex items-center justify-center"
          style={{
            background: 'rgba(245,166,35,0.08)',
            border: '1px solid rgba(245,166,35,0.2)',
          }}
          whileTap={{ scale: 0.95 }}
          aria-label="Abrir panel en vivo"
        >
          <LineChart className="w-5 h-5 text-[#F5A623]" />
        </motion.button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden relative z-10">
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
