'use client'

import { motion } from 'framer-motion'
import { AlertTriangle } from 'lucide-react'

interface ConfirmTradeDialogProps {
  proposal: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmTradeDialog({ proposal, onConfirm, onCancel }: ConfirmTradeDialogProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 28 }}
      className="rounded-2xl p-5 mt-3"
      style={{
        background: 'linear-gradient(135deg, var(--bg-1) 0%, var(--bg-2) 100%)',
        border: '1px solid rgba(245, 166, 35, 0.2)',
        boxShadow: '0 0 30px var(--amber-radiant), 0 8px 32px rgba(0,0,0,0.3)',
      }}
    >
      <div className="flex items-start gap-4 mb-5">
        <div 
          className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{
            background: 'var(--amber-soft)',
            border: '1px solid rgba(245, 166, 35, 0.2)',
          }}
        >
          <AlertTriangle className="w-5 h-5 text-amber" strokeWidth={1.5} />
        </div>
        <div>
          <h4 className="text-[15px] font-semibold text-fg mb-1.5 tracking-tight-custom">
            Tanit propone una operacion
          </h4>
          <p className="text-[14px] text-fg-1 leading-relaxed">{proposal}</p>
        </div>
      </div>

      <div className="flex gap-3">
        <motion.button
          onClick={onConfirm}
          whileTap={{ scale: 0.97 }}
          className="flex-1 py-3 px-4 rounded-xl bg-amber text-black font-medium text-[15px]
                     transition-all duration-200"
          style={{
            boxShadow: '0 0 20px var(--amber-glow), 0 0 40px var(--amber-radiant)',
          }}
        >
          Si, autorizo
        </motion.button>
        <motion.button
          onClick={onCancel}
          whileTap={{ scale: 0.97 }}
          className="flex-1 py-3 px-4 rounded-xl text-fg-1 font-medium text-[15px]
                     hover:bg-glass-bg transition-all duration-200"
          style={{
            border: '1px solid var(--glass-border)',
          }}
        >
          No, cancela
        </motion.button>
      </div>
    </motion.div>
  )
}
