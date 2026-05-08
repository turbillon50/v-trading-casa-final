'use client'

/**
 * ImageLightbox — modal fullscreen para ver una imagen al tamaño completo.
 *
 * Click en cualquier thumbnail dispara onOpen(src). El padre setea state y
 * pasa src a este componente. Esc, click fuera, o el botón X cierran.
 *
 * Acepta zoom táctil nativo del browser (overflow + max ancho/alto del
 * viewport). En desktop, click en la imagen también cierra.
 */

import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Download } from 'lucide-react'

interface ImageLightboxProps {
  src: string | null
  alt?: string
  filename?: string
  onClose: () => void
}

export function ImageLightbox({ src, alt = 'imagen', filename, onClose }: ImageLightboxProps) {
  useEffect(() => {
    if (!src) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    // Bloquear scroll del body mientras está abierto
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [src, onClose])

  return (
    <AnimatePresence>
      {src && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/95 backdrop-blur-md"
          onClick={onClose}
          role="dialog"
          aria-label="Visor de imagen"
        >
          {/* Botones flotantes (no se cierran al click) */}
          <div
            className="absolute top-3 right-3 flex items-center gap-2 z-10"
            onClick={(e) => e.stopPropagation()}
          >
            {filename && (
              <a
                href={src}
                download={filename}
                className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors backdrop-blur-md"
                aria-label="Descargar"
                title="Descargar"
              >
                <Download className="w-5 h-5" />
              </a>
            )}
            <button
              onClick={onClose}
              className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors backdrop-blur-md"
              aria-label="Cerrar"
              title="Cerrar (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <motion.img
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 280, damping: 30 }}
            src={src}
            alt={alt}
            onClick={(e) => e.stopPropagation()}
            className="max-w-[94vw] max-h-[88vh] object-contain rounded-lg shadow-2xl"
            draggable={false}
          />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
