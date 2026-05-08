'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Shield, X } from 'lucide-react'

interface KillSwitchButtonProps {
  isActive?: boolean
  onToggle?: (active: boolean) => void
}

export function KillSwitchButton({ isActive = false, onToggle }: KillSwitchButtonProps) {
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleClick = () => {
    if (isActive) {
      onToggle?.(false)
    } else {
      setShowConfirm(true)
    }
  }

  const handleConfirm = async () => {
    setLoading(true)
    await new Promise((resolve) => setTimeout(resolve, 500))
    onToggle?.(true)
    setLoading(false)
    setShowConfirm(false)
  }

  return (
    <>
      <motion.button
        onClick={handleClick}
        whileTap={{ scale: 0.94 }}
        className={`
          relative p-2.5 rounded-xl transition-all duration-200
          ${
            isActive
              ? 'text-error'
              : 'text-fg-3 hover:text-fg-1 hover:bg-glass-bg'
          }
        `}
        style={isActive ? {
          background: 'var(--error-soft)',
          border: '1px solid rgba(239, 68, 68, 0.25)',
          boxShadow: '0 0 20px rgba(239, 68, 68, 0.3)',
        } : undefined}
        aria-label={isActive ? 'Desactivar kill switch' : 'Activar kill switch'}
      >
        {loading ? (
          <motion.div
            animate={{ opacity: [1, 0.4, 1] }}
            transition={{ duration: 0.6, repeat: Infinity }}
          >
            <Shield className="w-5 h-5" strokeWidth={1.5} />
          </motion.div>
        ) : (
          <Shield className="w-5 h-5" strokeWidth={1.5} />
        )}
        {isActive && (
          <motion.div
            className="absolute inset-0 rounded-xl pointer-events-none"
            style={{
              boxShadow: '0 0 16px rgba(239, 68, 68, 0.4)',
            }}
            animate={{ opacity: [0.4, 0.8, 0.4] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}
      </motion.button>

      {/* Confirmation Dialog */}
      <AnimatePresence>
        {showConfirm && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80 backdrop-blur-md z-50"
              onClick={() => setShowConfirm(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: 'spring', stiffness: 300, damping: 28 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-sm rounded-2xl p-6 z-50"
              style={{
                background: 'linear-gradient(135deg, var(--bg-1) 0%, var(--bg-2) 100%)',
                border: '1px solid var(--glass-border)',
                boxShadow: '0 24px 48px rgba(0,0,0,0.5)',
              }}
            >
              <div className="flex items-start justify-between mb-5">
                <div 
                  className="w-12 h-12 rounded-xl flex items-center justify-center"
                  style={{
                    background: 'var(--error-soft)',
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                  }}
                >
                  <Shield className="w-6 h-6 text-error" strokeWidth={1.5} />
                </div>
                <button
                  onClick={() => setShowConfirm(false)}
                  className="p-2 rounded-xl hover:bg-glass-bg transition-all duration-200"
                >
                  <X className="w-5 h-5 text-fg-3" strokeWidth={1.5} />
                </button>
              </div>

              <h3 className="text-xl font-semibold text-fg mb-2 tracking-tight-custom">
                Activar kill-switch?
              </h3>
              <p className="text-[15px] text-fg-2 mb-6 leading-relaxed">
                Esto cerrara todas las posiciones abiertas y pausara las operaciones automaticas.
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowConfirm(false)}
                  className="flex-1 py-3 px-4 rounded-xl text-fg-1 font-medium text-[15px]
                             hover:bg-glass-bg transition-all duration-200 active:scale-[0.98]"
                  style={{
                    border: '1px solid var(--glass-border)',
                  }}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={loading}
                  className="flex-1 py-3 px-4 rounded-xl bg-error text-white font-medium text-[15px]
                             transition-all duration-200 disabled:opacity-50 active:scale-[0.98]"
                  style={{
                    boxShadow: '0 0 20px rgba(239, 68, 68, 0.3)',
                  }}
                >
                  {loading ? 'Activando...' : 'Confirmar'}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
