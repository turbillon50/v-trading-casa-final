'use client'

import { useState, useCallback, useRef } from 'react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://tanit-production.up.railway.app/api'

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
  type: 'thinking' | 'heartbeat' | 'token' | 'done' | 'error'
  content?: string
  data?: Record<string, unknown>
}

export function useTanitChat(options: UseTanitChatOptions = {}) {
  const {
    channel = 'intimate',
    resourceId = 'v-trading-web',
    threadId,
  } = options

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [orbState, setOrbState] = useState<OrbState>('idle')
  const [flickerKey, setFlickerKey] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [isConnected, setIsConnected] = useState(true)
  
  const abortControllerRef = useRef<AbortController | null>(null)
  const currentThreadId = useRef<string>(threadId || `thread-${Date.now()}`)

  // Fetch chat history
  const fetchHistory = useCallback(async (limit = 50) => {
    try {
      const response = await fetch(
        `${API_URL}/bot/mastra-history?limit=${limit}&channel=${channel}`
      )
      if (!response.ok) throw new Error('Failed to fetch history')
      
      const data = await response.json()
      // Transform history to ChatMessage format
      const historyMessages: ChatMessage[] = data.messages?.map((msg: {
        id: string
        role: string
        content: string
        created_at: string
        metadata?: Record<string, unknown>
      }) => ({
        id: msg.id,
        sender: msg.role === 'assistant' ? 'tanit' : 'luis',
        content: msg.content,
        timestamp: new Date(msg.created_at),
        inlineCard: msg.metadata?.inlineCard as ChatMessage['inlineCard'],
        needsConfirmation: msg.metadata?.needsConfirmation as ChatMessage['needsConfirmation'],
      })) || []
      
      setMessages(historyMessages)
      setIsConnected(true)
    } catch (err) {
      console.error('[v0] Error fetching history:', err)
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
                  
                case 'error':
                  setOrbState('error')
                  setError(event.content || 'Error desconocido')
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
    fetchHistory,
    cancelRequest,
    clearMessages,
  }
}
