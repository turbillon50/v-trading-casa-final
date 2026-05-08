'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { MessageSquare, Plus, MoreHorizontal, Edit2, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useThreads } from '@/hooks/use-threads'

/**
 * Lista de chats del usuario, estilo ChatGPT/Claude.
 * Va dentro del LeftSidebar (sustituye o complementa la nav minimal).
 */
export function ThreadsList({
  onSelect,
  activeThreadId,
}: {
  onSelect: (threadId: string) => void
  activeThreadId: string | null
}) {
  const { threads, loading, error, createNew, rename, remove } = useThreads('luis')
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-3 pt-3 pb-2">
        <button
          onClick={async () => {
            const id = await createNew()
            if (id) onSelect(id)
          }}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg
                     bg-amber/10 hover:bg-amber/15 border border-amber/30
                     text-amber text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Nuevo chat</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar px-2 pb-2">
        <div className="text-[10px] uppercase tracking-[0.2em] text-fg-3 px-2 py-2">
          Chats
        </div>
        {loading && threads.length === 0 && (
          <div className="text-fg-3 text-xs px-2 py-1">cargando…</div>
        )}
        {error && (
          <div className="text-error/70 text-xs px-2 py-1">{error}</div>
        )}
        {threads.length === 0 && !loading && (
          <div className="text-fg-3 text-xs px-2 py-1 italic">aún no hay chats</div>
        )}

        <AnimatePresence initial={false}>
          {threads.map((t) => {
            const isActive = t.id === activeThreadId
            const isEditing = editingId === t.id
            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={`group relative rounded-lg mb-0.5 ${
                  isActive ? 'bg-amber/10 border border-amber/20' : 'hover:bg-bg-2 border border-transparent'
                }`}
              >
                {isEditing ? (
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault()
                      const v = editValue.trim()
                      if (v) await rename(t.id, v)
                      setEditingId(null)
                    }}
                    className="flex items-center gap-2 px-3 py-2"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-amber flex-shrink-0" />
                    <input
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={() => setEditingId(null)}
                      autoFocus
                      className="flex-1 bg-transparent text-sm text-fg outline-none border-b border-amber/30"
                      maxLength={120}
                    />
                  </form>
                ) : (
                  <>
                    <button
                      onClick={() => onSelect(t.id)}
                      className="w-full flex items-start gap-2 px-3 py-2 text-left"
                    >
                      <MessageSquare
                        className={`w-3.5 h-3.5 flex-shrink-0 mt-0.5 ${
                          isActive ? 'text-amber' : 'text-fg-3'
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <div
                          className={`text-[13px] font-medium truncate ${
                            isActive ? 'text-amber' : 'text-fg'
                          }`}
                        >
                          {t.title || 'Conversación nueva'}
                        </div>
                        {t.preview && (
                          <div className="text-[11px] text-fg-3 truncate mt-0.5">
                            {t.preview}
                          </div>
                        )}
                      </div>
                      <span className="text-[10px] text-fg-3 font-mono flex-shrink-0">
                        {t.messageCount}
                      </span>
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setOpenMenu(openMenu === t.id ? null : t.id)
                      }}
                      className="absolute right-1 top-1.5 p-1 rounded hover:bg-bg-3 opacity-0 group-hover:opacity-100 transition-opacity"
                      aria-label="Opciones"
                    >
                      <MoreHorizontal className="w-3.5 h-3.5 text-fg-3" />
                    </button>

                    {openMenu === t.id && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -4 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        className="absolute right-1 top-7 z-50 bg-bg-2 border border-border rounded-lg shadow-xl p-1 min-w-[140px]"
                        onMouseLeave={() => setOpenMenu(null)}
                      >
                        <button
                          onClick={() => {
                            setEditValue(t.title || '')
                            setEditingId(t.id)
                            setOpenMenu(null)
                          }}
                          className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-fg hover:bg-bg-3 rounded"
                        >
                          <Edit2 className="w-3 h-3" /> Renombrar
                        </button>
                        <button
                          onClick={async () => {
                            if (confirm('¿Eliminar este chat? No se puede deshacer.')) {
                              await remove(t.id)
                            }
                            setOpenMenu(null)
                          }}
                          className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-error hover:bg-error/10 rounded"
                        >
                          <Trash2 className="w-3 h-3" /> Eliminar
                        </button>
                      </motion.div>
                    )}
                  </>
                )}
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </div>
  )
}
