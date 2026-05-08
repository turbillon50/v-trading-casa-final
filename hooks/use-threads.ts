'use client'

import { useCallback, useEffect, useState } from 'react'
import { api, type ThreadSummary } from '@/lib/api'

/**
 * Gestiona la lista de threads del usuario y el thread activo.
 * Persiste el thread activo en localStorage para que cuando Luis vuelva
 * abra el chat donde lo dejó.
 */
const STORAGE_KEY = 'v-trading.activeThreadId'

export function useThreads(resourceId = 'luis') {
  const [threads, setThreads] = useState<ThreadSummary[]>([])
  const [activeThreadId, setActiveThreadIdState] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Restaurar thread activo de localStorage al primer mount.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const saved = window.localStorage.getItem(STORAGE_KEY)
    if (saved) setActiveThreadIdState(saved)
  }, [])

  const setActiveThreadId = useCallback((id: string | null) => {
    setActiveThreadIdState(id)
    if (typeof window !== 'undefined') {
      if (id) window.localStorage.setItem(STORAGE_KEY, id)
      else window.localStorage.removeItem(STORAGE_KEY)
    }
  }, [])

  const refresh = useCallback(async () => {
    try {
      setLoading(true)
      const r = await api.listThreads(resourceId, 50)
      setThreads(r.threads ?? [])
      setError(null)
      // Si no hay thread activo seleccionado, agarra el primero (más reciente)
      if (!activeThreadId && r.threads?.[0]) {
        setActiveThreadId(r.threads[0].id)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'sin conexión')
    } finally {
      setLoading(false)
    }
  }, [resourceId, activeThreadId, setActiveThreadId])

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resourceId])

  const createNew = useCallback(
    async (title?: string) => {
      try {
        const r = await api.createThread(resourceId, title ?? 'Conversación nueva')
        await refresh()
        setActiveThreadId(r.threadId)
        return r.threadId
      } catch (e) {
        setError(e instanceof Error ? e.message : 'error creando thread')
        return null
      }
    },
    [resourceId, refresh, setActiveThreadId],
  )

  const rename = useCallback(
    async (threadId: string, title: string) => {
      try {
        await api.renameThread(threadId, title)
        await refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'error renombrando')
      }
    },
    [refresh],
  )

  const remove = useCallback(
    async (threadId: string) => {
      try {
        await api.deleteThread(threadId)
        if (activeThreadId === threadId) setActiveThreadId(null)
        await refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'error eliminando')
      }
    },
    [activeThreadId, refresh, setActiveThreadId],
  )

  return {
    threads,
    activeThreadId,
    setActiveThreadId,
    loading,
    error,
    refresh,
    createNew,
    rename,
    remove,
  }
}
