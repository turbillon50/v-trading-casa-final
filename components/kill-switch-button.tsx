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
      // Deactivate immediately
      onToggle?.(false)
    } else {
      // Show confirmation dialog
      setShowConfirm(true)
    }
  }

  const handleConfirm = async () => {
    setLoading(true)
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 500))
    onToggle?.(true)
    setLoading(false)
    setShowConfirm(false)
  }

  return (
    <>
      <button
        onClick={handleClick}
        className={`
          relative p-2 rounded-lg transition-all duration-200
          ${
            isActive
              ? 'bg-error/20 text-error'
              : 'text-fg-2 hover:text-fg hover:bg-bg-elev'
          }
        `}
        aria-label={isActive ? 'Desactivar kill switch' : 'Activar kill switch'}
      >
        {loading ? (
          <motion.div
            animate={{ opacity: [1, 0.5, 1] }}
            transition={{ duration: 0.5, repeat: Infinity }}
          >
            <Shield className="w-5 h-5" />
          </motion.div>
        ) : (
          <Shield className="w-5 h-5" />
        )}
        {isActive && (
          <motion.div
            className="absolute inset-0 rounded-lg"
            style={{
              boxShadow: '0 0 12px rgba(244, 63, 94, 0.4)',
            }}
            animate={{ opacity: [0.4, 0.8, 0.4] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
        )}
      </button>

      {/* Confirmation Dialog */}
      <AnimatePresence>
        {showConfirm && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-50"
              onClick={() => setShowConfirm(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 280, damping: 30 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-sm glass rounded-2xl p-5 z-50"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-10 h-10 rounded-xl bg-error/20 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-error" />
                </div>
                <button
                  onClick={() => setShowConfirm(false)}
                  className="p-1 rounded-lg hover:bg-bg-elev transition-colors"
                >
                  <X className="w-4 h-4 text-fg-3" />
                </button>
              </div>

              <h3 className="text-lg font-semibold text-fg mb-2">
                Activar kill-switch?
              </h3>
              <p className="text-sm text-fg-2 mb-5">
                Esto cerrara todas las posiciones abiertas y pausara las operaciones automaticas.
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowConfirm(false)}
                  className="flex-1 py-2.5 px-4 rounded-lg border border-border-1 text-fg-1 font-medium text-sm
                             hover:bg-bg-elev hover:text-fg transition-all duration-200"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={loading}
                  className="flex-1 py-2.5 px-4 rounded-lg bg-error text-white font-medium text-sm
                             hover:bg-error/90 transition-all duration-200 disabled:opacity-50"
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
