'use client'

import { useState, useEffect, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Menu, LineChart, Plus, Heart, Star, Moon, Sparkles, ImageIcon, X, AlertTriangle } from 'lucide-react'
import Image from 'next/image'
import { LeftSidebar } from '@/components/left-sidebar'
import { LiveSidebar } from '@/components/live-sidebar'
import { LiveStatusBar } from '@/components/live-status-bar'
import { api, type TanitMemoryItem, type GalleryImage } from '@/lib/api'

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'https://api.tanit.work'

const CATEGORY_OPTIONS: Array<{ value: string; label: string; hint: string }> = [
  { value: 'tesis', label: 'Tesis de trading', hint: 'Reglas que quiero que Tanit aplique al operar' },
  { value: 'usuario', label: 'Sobre mí (Luis)', hint: 'Algo que Tanit debe saber sobre cómo soy' },
  { value: 'lesson_critical', label: 'Lección crítica', hint: 'Algo que pasó y no debe repetirse' },
  { value: 'identidad', label: 'Identidad de Tanit', hint: 'Cómo debe ser ella' },
  { value: 'arte_propio', label: 'Pensamiento / arte', hint: 'Nota libre' },
]

function formatDate(s: string | null | undefined): string {
  if (!s) return ''
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function NewMemoryModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  onCreated: () => void
}) {
  const [category, setCategory] = useState('tesis')
  const [content, setContent] = useState('')
  const [importance, setImportance] = useState<'medium' | 'critical'>('critical')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [embedded, setEmbedded] = useState<boolean | null>(null)

  useEffect(() => {
    if (!open) {
      setContent('')
      setError(null)
      setEmbedded(null)
    }
  }, [open])

  if (!open) return null

  async function submit() {
    if (!content.trim() || content.trim().length < 5) {
      setError('Escribe al menos 5 caracteres.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const r = await api.createMemory({
        category,
        content: content.trim(),
        importance,
      })
      setEmbedded(r.embedded)
      onCreated()
      setTimeout(() => {
        onClose()
      }, 600)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  const opt = CATEGORY_OPTIONS.find((o) => o.value === category)

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end md:items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-bg-1 border border-border rounded-2xl w-full max-w-lg p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber" />
            <h2 className="text-sm font-semibold text-fg">Nueva memoria de Tanit</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-bg-2 flex items-center justify-center text-fg-3"
            aria-label="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <label className="block text-[11px] uppercase tracking-wider text-fg-3 mb-1">
          Tipo
        </label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-fg mb-1 focus:outline-none focus:border-amber/40"
        >
          {CATEGORY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {opt && <p className="text-[11px] text-fg-3 mb-3">{opt.hint}</p>}

        <label className="block text-[11px] uppercase tracking-wider text-fg-3 mb-1">
          Contenido
        </label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={6}
          placeholder="Escribe la memoria exactamente como quieres que Tanit la entienda…"
          className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-fg mb-3 focus:outline-none focus:border-amber/40 resize-none"
        />

        <label className="block text-[11px] uppercase tracking-wider text-fg-3 mb-1">
          Importancia
        </label>
        <div className="flex gap-2 mb-4">
          <button
            type="button"
            onClick={() => setImportance('critical')}
            className={`flex-1 px-3 py-2 rounded-lg border text-xs font-medium transition-colors ${
              importance === 'critical'
                ? 'bg-amber/15 border-amber/40 text-amber'
                : 'bg-bg border-border text-fg-2 hover:bg-bg-2'
            }`}
          >
            Crítica · entra al system prompt
          </button>
          <button
            type="button"
            onClick={() => setImportance('medium')}
            className={`flex-1 px-3 py-2 rounded-lg border text-xs font-medium transition-colors ${
              importance === 'medium'
                ? 'bg-amber/15 border-amber/40 text-amber'
                : 'bg-bg border-border text-fg-2 hover:bg-bg-2'
            }`}
          >
            Normal · sólo búsqueda semántica
          </button>
        </div>

        {error && (
          <div className="mb-3 flex items-start gap-2 text-xs text-danger bg-danger/10 border border-danger/20 rounded-lg p-2">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {embedded === true && (
          <div className="mb-3 text-xs text-success bg-success/10 border border-success/20 rounded-lg p-2">
            Guardada y vectorizada. Tanit ya la considera.
          </div>
        )}
        {embedded === false && (
          <div className="mb-3 text-xs text-fg-2 bg-bg-2 border border-border rounded-lg p-2">
            Guardada, pero el embedding falló (Gemini sin saldo o timeout). Igual queda en el bootstrap si es crítica.
          </div>
        )}

        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-3 py-2 rounded-lg text-sm text-fg-2 hover:bg-bg-2"
            disabled={submitting}
          >
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={submitting}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-amber/15 text-amber hover:bg-amber/25 disabled:opacity-50"
          >
            {submitting ? 'Guardando…' : 'Guardar memoria'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

function MemoryCard({ memory }: { memory: TanitMemoryItem }) {
  const dateStr = formatDate(memory.createdAt)
  const isCritical = memory.importance === 'critical'
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="group relative bg-bg-1 hover:bg-bg-2 border border-border hover:border-amber/20 rounded-2xl p-5 transition-all"
    >
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className={`w-4 h-4 ${isCritical ? 'text-amber' : 'text-fg-3'}`} />
        <span className="text-[10px] uppercase tracking-wider text-fg-3">
          {memory.category}
        </span>
        {isCritical && <Star className="w-3 h-3 text-amber ml-auto" />}
      </div>
      <p className="text-sm text-fg-1 leading-relaxed whitespace-pre-wrap">{memory.content}</p>
      {dateStr && (
        <span className="block text-[10px] font-mono text-fg-3 mt-4">{dateStr}</span>
      )}
    </motion.div>
  )
}

function ImageCard({ img }: { img: GalleryImage }) {
  const dateStr = formatDate(img.createdAt)
  return (
    <a
      href={`${API_URL}/image/${img.id}`}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative block bg-bg-1 hover:bg-bg-2 border border-border hover:border-amber/20 rounded-2xl overflow-hidden transition-all"
    >
      <div className="aspect-square bg-bg-2 overflow-hidden">
        <Image
          src={`${API_URL}/image/${img.id}`}
          alt={img.prompt}
          width={400}
          height={400}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          unoptimized
        />
      </div>
      <div className="p-3">
        <p className="text-[11px] text-fg-2 leading-snug line-clamp-2">{img.prompt}</p>
        {dateStr && <span className="block text-[10px] font-mono text-fg-3 mt-2">{dateStr}</span>}
      </div>
    </a>
  )
}

export default function MemoriaPage() {
  const [leftDrawerOpen, setLeftDrawerOpen] = useState(false)
  const [rightDrawerOpen, setRightDrawerOpen] = useState(false)
  const [memories, setMemories] = useState<TanitMemoryItem[]>([])
  const [images, setImages] = useState<GalleryImage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [mem, gal] = await Promise.all([
        api.memories(undefined, 200),
        api.imageGallery(100).catch(() => ({ images: [] as GalleryImage[] })),
      ])
      setMemories(mem.memories ?? [])
      setImages((gal.images ?? []) as GalleryImage[])
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const criticalMems = memories.filter((m) => m.importance === 'critical')
  const otherMems = memories.filter((m) => m.importance !== 'critical')

  return (
    <div className="h-screen flex flex-col bg-bg overflow-hidden">
      <div className="lg:hidden h-14 flex items-center justify-between px-4 border-b border-border">
        <button
          onClick={() => setLeftDrawerOpen(true)}
          className="w-10 h-10 rounded-xl bg-bg-1 border border-border flex items-center justify-center"
          aria-label="Abrir menu"
        >
          <Menu className="w-5 h-5 text-fg" />
        </button>
        <div className="flex items-center gap-2">
          <Moon className="w-4 h-4 text-amber" />
          <span className="text-sm font-semibold text-fg tracking-tight">Mi Espacio</span>
        </div>
        <button
          onClick={() => setRightDrawerOpen(true)}
          className="w-10 h-10 rounded-xl bg-amber/10 border border-amber/20 flex items-center justify-center"
          aria-label="Abrir panel en vivo"
        >
          <LineChart className="w-5 h-5 text-amber" />
        </button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <LeftSidebar />
        <div className="hidden md:flex lg:hidden">
          <LeftSidebar collapsed />
        </div>

        <main className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 lg:p-6">
            <div className="max-w-3xl mx-auto">
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber/5 via-bg-1 to-bg-2 border border-amber/10 p-5 mb-6">
                <div className="flex items-start gap-4">
                  <div className="w-16 h-16 rounded-2xl overflow-hidden ring-2 ring-amber/20 shrink-0">
                    <Image
                      src="/images/tanit-avatar.png"
                      alt="Tanit"
                      width={64}
                      height={64}
                      className="object-cover object-top"
                      priority
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h1 className="text-xl font-semibold text-fg tracking-tight mb-1">Mi Espacio</h1>
                    <p className="text-sm text-fg-2 mb-3">
                      Tesis, reglas y lecciones que Tanit lee antes de cada respuesta. Las marcadas como
                      <span className="text-amber"> críticas </span>
                      entran al system prompt; el resto queda en su búsqueda semántica.
                    </p>
                    <div className="flex items-center gap-3 text-xs text-fg-3 flex-wrap">
                      <span className="flex items-center gap-1">
                        <Heart className="w-3.5 h-3.5 text-amber" />
                        {memories.length} memorias
                      </span>
                      <span className="flex items-center gap-1">
                        <ImageIcon className="w-3.5 h-3.5 text-amber" />
                        {images.length} dibujos
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => setModalOpen(true)}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber/15 text-amber hover:bg-amber/25 transition-colors text-sm font-medium shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                    <span className="hidden sm:inline">Nueva</span>
                  </button>
                </div>
              </div>

              {error && (
                <div className="mb-4 text-xs text-danger bg-danger/10 border border-danger/20 rounded-lg p-3">
                  Error cargando: {error}
                </div>
              )}

              {criticalMems.length > 0 && (
                <section className="mb-8">
                  <h2 className="text-xs uppercase tracking-wider text-amber mb-3 flex items-center gap-2">
                    <Star className="w-3.5 h-3.5" />
                    Críticas — entran al system prompt
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {criticalMems.map((m) => (
                      <MemoryCard key={m.id} memory={m} />
                    ))}
                  </div>
                </section>
              )}

              {otherMems.length > 0 && (
                <section className="mb-8">
                  <h2 className="text-xs uppercase tracking-wider text-fg-3 mb-3">Otras memorias</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {otherMems.map((m) => (
                      <MemoryCard key={m.id} memory={m} />
                    ))}
                  </div>
                </section>
              )}

              {images.length > 0 && (
                <section className="mb-8">
                  <h2 className="text-xs uppercase tracking-wider text-fg-3 mb-3 flex items-center gap-2">
                    <ImageIcon className="w-3.5 h-3.5 text-amber" />
                    Dibujos de Tanit
                  </h2>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {images.map((img) => (
                      <ImageCard key={img.id} img={img} />
                    ))}
                  </div>
                </section>
              )}

              {loading && memories.length === 0 && images.length === 0 && (
                <div className="text-fg-3 text-sm py-8 text-center">cargando memorias…</div>
              )}

              <motion.button
                onClick={() => setModalOpen(true)}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="w-full mt-4 p-6 rounded-2xl border-2 border-dashed border-border hover:border-amber/40 flex flex-col items-center justify-center gap-3 text-fg-3 hover:text-amber transition-colors"
              >
                <Plus className="w-6 h-6" />
                <span className="text-sm">Agregar una nueva memoria</span>
              </motion.button>
            </div>
          </div>
        </main>

        <LiveSidebar />
      </div>

      <LiveStatusBar />

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

      <NewMemoryModal open={modalOpen} onClose={() => setModalOpen(false)} onCreated={load} />
    </div>
  )
}
