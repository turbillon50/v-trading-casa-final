'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { API_URL, api } from '@/lib/api'

export interface ChatMessage {
  id: string
  sender: 'tanit' | 'luis'
  content: string
  timestamp: Date
  inlineCard?: {
    type: 'balance' | 'positions' | 'price' | 'decision'
    summary: string
    data: Record<string, unknown>
  }
  needsConfirmation?: {
    proposal: string
  }
}

export type OrbState = 'idle' | 'thinking' | 'streaming' | 'error' | 'muted'

interface UseTanitChatOptions {
  channel?: string
  resourceId?: string
  threadId?: string
}

interface SSEEvent {
  type:
    | 'thinking'
    | 'heartbeat'
    | 'token'
    | 'done'
    | 'error'
    | 'tool_call'
    | 'tool_result'
  content?: string
  data?: Record<string, unknown>
  // tool_call / tool_result fields:
  toolCallId?: string
  tool?: string
  args?: Record<string, unknown>
  result?: Record<string, unknown>
  message?: string
}

/**
 * Mapea un tool name + result del backend al tipo de InlineCard
 * que el componente <InlineCard /> entiende.
 */
function inlineCardFromToolResult(
  tool: string,
  result: Record<string, unknown>,
): ChatMessage['inlineCard'] | undefined {
  if (!result) return undefined
  const t = tool.toLowerCase()

  if (t.includes('balance')) {
    const equity = (result.equity as number) ?? 0
    const available = (result.available as number) ?? 0
    const total = (result.total as number) ?? 0
    const testnet = (result.testnet as boolean) ?? false
    return {
      type: 'balance',
      summary: `${testnet ? 'testnet · ' : ''}equity $${equity.toFixed(2)} · disponible $${available.toFixed(2)}`,
      data: { equity, available, total, pnl: 0, ...result },
    }
  }

  if (t.includes('posicion') || t.includes('position')) {
    const positions = (result.positions as unknown[]) ?? []
    return {
      type: 'positions',
      summary:
        positions.length === 0
          ? 'sin posiciones abiertas'
          : `${positions.length} posición${positions.length === 1 ? '' : 'es'} abierta${positions.length === 1 ? '' : 's'}`,
      data: { positions, ...result },
    }
  }

  if (t.includes('precio') || t.includes('price')) {
    const symbol = (result.symbol as string) ?? '?'
    const lastPrice = (result.lastPrice as number) ?? 0
    return {
      type: 'price',
      summary: `${symbol} · $${lastPrice.toLocaleString()}`,
      data: result,
    }
  }

  if (t.includes('decis') || t.includes('decision')) {
    return {
      type: 'decision',
      summary: 'Decisión registrada',
      data: result,
    }
  }

  // fallback genérico — InlineCard renderiza el JSON
  return {
    type: 'decision',
    summary: tool,
    data: result,
  }
}

export function useTanitChat(options: UseTanitChatOptions = {}) {
  const {
    channel = 'intimate',
    resourceId = 'luis',
    threadId,
  } = options

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [orbState, setOrbState] = useState<OrbState>('idle')
  const [flickerKey, setFlickerKey] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [isConnected, setIsConnected] = useState(true)

  const abortControllerRef = useRef<AbortController | null>(null)
  const currentThreadId = useRef<string>(threadId || `intimate-main`)

  // Cuando cambia el threadId desde el componente padre, actualiza el ref y
  // reset de mensajes (la nueva carga vendrá de loadThreadMessages).
  useEffect(() => {
    if (threadId && threadId !== currentThreadId.current) {
      currentThreadId.current = threadId
    }
  }, [threadId])

  // Fetch chat history. El backend devuelve { ok, channel, count, messages: [
  //   { id, role, content, senderType, channel, createdAt }
  // ] } — sin metadata.inlineCard / metadata.needsConfirmation. Esos los
  // detectamos heurísticamente del propio content (texto que Tanit escribió
  // con marcador "Si sí, dímelo y reinvoco con confirmado=true.").
  const fetchHistory = useCallback(async (limit = 50) => {
    try {
      const data = await api.chatHistory(limit, channel as 'intimate' | 'operational')
      const historyMessages: ChatMessage[] = (data.messages ?? []).map((msg) => {
        const isConfirmation = /confirmado=true|reinvoco con confirmado/i.test(msg.content)
        return {
          id: String(msg.id),
          sender: msg.role === 'assistant' ? 'tanit' : 'luis',
          content: msg.content,
          timestamp: new Date(msg.createdAt),
          needsConfirmation: isConfirmation
            ? { proposal: msg.content }
            : undefined,
        }
      })
      setMessages(historyMessages)
      setIsConnected(true)
    } catch (err) {
      console.error('[chat] fetchHistory error:', err)
      setIsConnected(false)
    }
  }, [channel])

  // Send message with SSE streaming
  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isLoading) return

    // Cancel any ongoing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    abortControllerRef.current = new AbortController()

    // Add user message
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'luis',
      content: content.trim(),
      timestamp: new Date(),
    }
    setMessages(prev => [...prev, userMessage])
    setIsLoading(true)
    setOrbState('thinking')
    setError(null)

    try {
      const response = await fetch(`${API_URL}/bot/mastra-chat-stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: content.trim(),
          channel,
          sender_type: 'user',
          resourceId,
          threadId: currentThreadId.current,
        }),
        signal: abortControllerRef.current.signal,
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const reader = response.body?.getReader()
      if (!reader) throw new Error('No reader available')

      const decoder = new TextDecoder()
      let tanitContent = ''
      let tanitMessageId = `tanit-${Date.now()}`
      let hasStartedStreaming = false

      // Add placeholder Tanit message
      const tanitMessage: ChatMessage = {
        id: tanitMessageId,
        sender: 'tanit',
        content: '',
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, tanitMessage])

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n').filter(line => line.trim())

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const event: SSEEvent = JSON.parse(line.slice(6))
              
              switch (event.type) {
                case 'thinking':
                  setOrbState('thinking')
                  break
                  
                case 'token':
                  if (!hasStartedStreaming) {
                    hasStartedStreaming = true
                    setOrbState('streaming')
                  }
                  tanitContent += event.content || ''
                  setFlickerKey(k => k + 1)
                  setMessages(prev => 
                    prev.map(msg => 
                      msg.id === tanitMessageId 
                        ? { ...msg, content: tanitContent }
                        : msg
                    )
                  )
                  break
                  
                case 'done':
                  setOrbState('idle')
                  // Check for inline cards or confirmation needs in final data
                  if (event.data) {
                    setMessages(prev => 
                      prev.map(msg => 
                        msg.id === tanitMessageId 
                          ? { 
                              ...msg, 
                              content: tanitContent,
                              inlineCard: event.data?.inlineCard as ChatMessage['inlineCard'],
                              needsConfirmation: event.data?.needsConfirmation as ChatMessage['needsConfirmation'],
                            }
                          : msg
                      )
                    )
                  }
                  break
                  
                case 'tool_call':
                  // Tanit invocó una tool. Aún no sabemos el resultado.
                  // Marcamos la conversación con "consultando" via flicker.
                  setOrbState('thinking')
                  break

                case 'tool_result': {
                  // Llegó el resultado de la tool. Si es read (balance,
                  // posiciones, precio), lo adjuntamos como inlineCard al
                  // mensaje actual de Tanit que se está streameando.
                  if (event.tool && event.result) {
                    const card = inlineCardFromToolResult(event.tool, event.result)
                    if (card) {
                      setMessages(prev =>
                        prev.map(msg =>
                          msg.id === tanitMessageId
                            ? { ...msg, inlineCard: card }
                            : msg,
                        ),
                      )
                    }
                  }
                  setOrbState('streaming')
                  break
                }

                case 'error':
                  setOrbState('error')
                  setError(event.content || event.message || 'Error desconocido')
                  setTimeout(() => setOrbState('idle'), 2000)
                  break

                case 'heartbeat':
                  // Keep connection alive
                  break
              }
            } catch {
              // Skip malformed JSON
            }
          }
        }
      }

      setIsConnected(true)
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        // Request was cancelled
        return
      }
      
      console.error('[v0] Error sending message:', err)
      setError('Conexion perdida — reintentando')
      setOrbState('error')
      setIsConnected(false)
      
      // Remove the empty Tanit message on error
      setMessages(prev => prev.filter(msg => msg.content || msg.sender === 'luis'))
      
      setTimeout(() => {
        setOrbState('idle')
        setError(null)
      }, 2000)
    } finally {
      setIsLoading(false)
      abortControllerRef.current = null
    }
  }, [channel, resourceId, isLoading])

  // Carga mensajes de un thread específico (cuando cambia el thread activo)
  const loadThreadMessages = useCallback(async (tid: string) => {
    try {
      currentThreadId.current = tid
      const r = await api.threadMessages(tid, 200)
      const mapped: ChatMessage[] = (r.messages ?? []).map((m) => {
        const isConfirmation = /confirmado=true|reinvoco con confirmado/i.test(m.content)
        return {
          id: String(m.id),
          sender: m.role === 'assistant' ? 'tanit' : 'luis',
          content: m.content,
          timestamp: new Date(m.createdAt),
          needsConfirmation: isConfirmation
            ? { proposal: m.content }
            : undefined,
        }
      })
      setMessages(mapped)
      setIsConnected(true)
    } catch (err) {
      console.error('[chat] loadThreadMessages error:', err)
      setIsConnected(false)
    }
  }, [])

  // Send message with image attachments (multimodal)
  const sendMessageWithImages = useCallback(
    async (content: string, images: Array<{ base64: string; mimeType: string }> = []) => {
      if ((!content.trim() && images.length === 0) || isLoading) return

      if (abortControllerRef.current) abortControllerRef.current.abort()
      abortControllerRef.current = new AbortController()

      const userMessage: ChatMessage = {
        id: `user-${Date.now()}`,
        sender: 'luis',
        content: content.trim() || (images.length ? '[imagen adjunta]' : ''),
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, userMessage])
      setIsLoading(true)
      setOrbState('thinking')
      setError(null)

      try {
        const response = await fetch(`${API_URL}/bot/mastra-chat-stream`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: content.trim() || 'Mira esta imagen y dime qué ves.',
            channel,
            sender_type: 'human_luis',
            resourceId,
            threadId: currentThreadId.current,
            images,
          }),
          signal: abortControllerRef.current.signal,
        })

        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const reader = response.body?.getReader()
        if (!reader) throw new Error('no reader')

        const decoder = new TextDecoder()
        let tanitContent = ''
        const tanitMessageId = `tanit-${Date.now()}`
        let hasStarted = false

        setMessages((prev) => [
          ...prev,
          {
            id: tanitMessageId,
            sender: 'tanit',
            content: '',
            timestamp: new Date(),
          },
        ])

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          const chunk = decoder.decode(value)
          const lines = chunk.split('\n').filter((l) => l.trim())
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            try {
              const event: SSEEvent = JSON.parse(line.slice(6))
              if (event.type === 'thinking') setOrbState('thinking')
              else if (event.type === 'token') {
                if (!hasStarted) {
                  hasStarted = true
                  setOrbState('streaming')
                }
                tanitContent += event.content || ''
                setFlickerKey((k) => k + 1)
                setMessages((prev) =>
                  prev.map((m) => (m.id === tanitMessageId ? { ...m, content: tanitContent } : m)),
                )
              } else if (event.type === 'tool_result') {
                if (event.tool && event.result) {
                  const card = inlineCardFromToolResult(event.tool, event.result)
                  if (card) {
                    setMessages((prev) =>
                      prev.map((m) => (m.id === tanitMessageId ? { ...m, inlineCard: card } : m)),
                    )
                  }
                }
              } else if (event.type === 'done') {
                setOrbState('idle')
              } else if (event.type === 'error') {
                setOrbState('error')
                setError(event.content || event.message || 'error')
                setTimeout(() => setOrbState('idle'), 2000)
              }
            } catch {
              /* skip malformed */
            }
          }
        }
        setIsConnected(true)
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return
        setError('Conexion perdida — reintentando')
        setOrbState('error')
        setIsConnected(false)
        setTimeout(() => {
          setOrbState('idle')
          setError(null)
        }, 2000)
      } finally {
        setIsLoading(false)
        abortControllerRef.current = null
      }
    },
    [channel, resourceId, isLoading],
  )

  // Cancel ongoing request
  const cancelRequest = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    setIsLoading(false)
    setOrbState('idle')
  }, [])

  // Clear messages
  const clearMessages = useCallback(() => {
    setMessages([])
    currentThreadId.current = `thread-${Date.now()}`
  }, [])

  return {
    messages,
    setMessages,
    isLoading,
    orbState,
    flickerKey,
    error,
    isConnected,
    sendMessage,
    sendMessageWithImages,
    fetchHistory,
    loadThreadMessages,
    cancelRequest,
    clearMessages,
    currentThreadId: currentThreadId.current,
  }
}
