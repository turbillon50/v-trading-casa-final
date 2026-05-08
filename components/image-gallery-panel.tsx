'use client'

/**
 * ImageGalleryPanel — modal con todas las imágenes generadas hasta hoy.
 *
 * Carga la lista vía /image/gallery (sólo metadata) y por cada item
 * compone el src apuntando a /image/:id que sirve el binario. Click en
 * cualquier miniatura abre el lightbox a tamaño completo.
 */

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Trash2, Loader2, ImageIcon as ImageIconLucide } from 'lucide-react'
import { api, type GalleryImage } from '@/lib/api'
import { ImageLightbox } from './image-lightbox'

interface Props {
  open: boolean
  onClose: () => void
}

export function ImageGalleryPanel({ open, onClose }: Props) {
  const [images, setImages] = useState<GalleryImage[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lightboxId, setLightboxId] = useState<number | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const r = await api.imageGallery(100)
      setImages(r.images)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'no se pudo cargar')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) load()
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && lightboxId == null) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose, lightboxId])

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('¿Eliminar esta imagen del baúl?')) return
    try {
      await api.deleteImage(id)
      setImages((prev) => prev.filter((i) => i.id !== id))
    } catch (err) {
      alert('no se pudo eliminar: ' + (err instanceof Error ? err.message : err))
    }
  }

  const lightboxImg = images.find((i) => i.id === lightboxId)

  return (
    <>
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md"
              onClick={onClose}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 8 }}
              transition={{ type: 'spring', stiffness: 280, damping: 28 }}
              className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2
                         w-[min(900px,94vw)] max-h-[88vh] flex flex-col
                         rounded-3xl border border-border bg-bg-1/95 backdrop-blur-2xl
                         shadow-2xl overflow-hidden"
              role="dialog"
              aria-label="Baúl de imágenes generadas"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                <div className="flex items-center gap-3 min-w-0">
                  <ImageIconLucide className="w-5 h-5 text-amber" />
                  <div className="min-w-0">
                    <div className="text-[15px] font-semibold text-fg">Baúl de imágenes</div>
                    <div className="text-[12px] text-fg-3">
                      {loading ? 'cargando…' : `${images.length} imagen${images.length === 1 ? '' : 'es'}`}
                    </div>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg text-fg-3 hover:text-fg hover:bg-bg-2 transition-colors"
                  aria-label="Cerrar"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
                {error && (
                  <div className="my-4 p-4 rounded-xl border border-error/30 bg-error/10 text-error text-[13px]">
                    {error}
                  </div>
                )}
                {loading && images.length === 0 && (
                  <div className="flex items-center justify-center py-16 text-fg-3">
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    cargando imágenes…
                  </div>
                )}
                {!loading && images.length === 0 && !error && (
                  <div className="flex flex-col items-center justify-center py-16 text-fg-3 text-center px-6">
                    <ImageIconLucide className="w-12 h-12 mb-3 opacity-40" />
                    <p className="text-[14px]">aún no hay imágenes en el baúl</p>
                    <p className="text-[12px] mt-1 opacity-70">
                      genera una con el botón ✨ del chat
                    </p>
                  </div>
                )}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {images.map((img) => (
                    <div
                      key={img.id}
                      className="group relative aspect-square rounded-xl overflow-hidden border border-border bg-bg-2 cursor-pointer"
                      onClick={() => setLightboxId(img.id)}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={api.imageUrl(img.id)}
                        alt={img.prompt}
                        loading="lazy"
                        className="w-full h-full object-cover transition-transform group-hover:scale-105"
                        draggable={false}
                      />
                      {/* Overlay con prompt al hover */}
                      <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/85 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                        <p className="text-[11px] text-white line-clamp-2">{img.prompt}</p>
                      </div>
                      {/* Botón borrar */}
                      <button
                        onClick={(e) => handleDelete(img.id, e)}
                        className="absolute top-1.5 right-1.5 p-1.5 rounded-md bg-black/60 text-white opacity-0 group-hover:opacity-100 hover:bg-error/80 transition-all"
                        aria-label="Borrar"
                        title="Borrar"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Lightbox para ver imagen completa */}
      <ImageLightbox
        src={lightboxImg ? api.imageUrl(lightboxImg.id) : null}
        alt={lightboxImg?.prompt}
        filename={lightboxImg ? `tanit-${lightboxImg.id}.png` : undefined}
        onClose={() => setLightboxId(null)}
      />
    </>
  )
}
