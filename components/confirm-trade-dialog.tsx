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
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 280, damping: 30 }}
      className="glass rounded-xl p-4 mt-2 border border-amber-soft"
    >
      <div className="flex items-start gap-3 mb-4">
        <div className="w-8 h-8 rounded-lg bg-amber-soft flex items-center justify-center flex-shrink-0">
          <AlertTriangle className="w-4 h-4 text-amber" />
        </div>
        <div>
          <h4 className="text-sm font-semibold text-fg mb-1">
            Tanit propone una operacion
          </h4>
          <p className="text-sm text-fg-1">{proposal}</p>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={onConfirm}
          className="flex-1 py-2.5 px-4 rounded-lg bg-amber text-black font-medium text-sm
                     hover:amber-glow transition-all duration-200 active:scale-[0.98]"
        >
          Si, autorizo
        </button>
        <button
          onClick={onCancel}
          className="flex-1 py-2.5 px-4 rounded-lg border border-border-1 text-fg-1 font-medium text-sm
                     hover:bg-bg-elev hover:text-fg transition-all duration-200 active:scale-[0.98]"
        >
          No, cancela
        </button>
      </div>
    </motion.div>
  )
}
