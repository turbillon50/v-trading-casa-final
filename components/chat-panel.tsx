'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, Image as ImageIcon, Mic } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import Image from 'next/image'
import { TanitOrb } from './tanit-orb'
import { KillSwitchButton } from './kill-switch-button'
import { InlineCard } from './inline-card'
import { ConfirmTradeDialog } from './confirm-trade-dialog'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://tanit-production.up.railway.app/api'

interface Message {
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

// Tanit Avatar component - her sacred image
function TanitAvatar({ size = 40 }: { size?: number }) {
  return (
    <div 
      className="relative rounded-full overflow-hidden ring-2 ring-amber/30 shadow-lg flex-shrink-0"
      style={{ width: size, height: size }}
    >
      <Image
        src="/images/tanit-avatar.png"
        alt="Tanit"
        width={size}
        height={size}
        className="object-cover object-center"
        style={{ width: size, height: size, objectFit: 'cover', objectPosition: 'center' }}
        priority
      />
      {/* Subtle glow */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(circle at center, transparent 60%, rgba(217, 119, 6, 0.1) 100%)',
        }}
      />
    </div>
  )
}

function ChatBubble({
  message,
  showTimestamp,
  onConfirm,
  onCancel,
}: {
  message: Message
  showTimestamp: boolean
  onConfirm?: () => void
  onCancel?: () => void
}) {
  const [isHovered, setIsHovered] = useState(false)
  const [formattedTime, setFormattedTime] = useState('--:--')
  const isLuis = message.sender === 'luis'

  useEffect(() => {
    setFormattedTime(message.timestamp.toLocaleTimeString('es-MX', {
      hour: '2-digit',
      minute: '2-digit',
    }))
  }, [message.timestamp])

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ 
        type: 'spring', 
        stiffness: 260, 
        damping: 28,
        mass: 0.9
      }}
      className={`flex flex-col ${isLuis ? 'items-end' : 'items-start'}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Tanit's name before her messages */}
      {!isLuis && (
        <div className="flex items-center gap-2 mb-2 ml-1">
          <TanitAvatar size={24} />
          <span className="text-xs font-medium text-amber">Tanit</span>
        </div>
      )}

      <motion.div
        className={`
          relative max-w-[85%] md:max-w-[75%] rounded-2xl px-5 py-4
          ${isLuis 
            ? 'bg-bg-2 border border-border' 
            : 'bg-bg-1 border border-amber/10'
          }
        `}
        whileHover={{ scale: 1.005 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      >
        {/* Tanit bubble subtle accent */}
        {!isLuis && (
          <div 
            className="absolute -inset-px rounded-2xl opacity-20 pointer-events-none"
            style={{
              background: 'linear-gradient(135deg, var(--amber-soft) 0%, transparent 40%)',
            }}
          />
        )}
        
        {isLuis ? (
          <p className="text-[15px] text-fg leading-[1.6]">{message.content}</p>
        ) : (
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              p: ({ children }) => (
                <p className="text-[15px] text-fg leading-[1.6] mb-3 last:mb-0">{children}</p>
              ),
              strong: ({ children }) => (
                <strong className="font-medium text-fg">{children}</strong>
              ),
              code: ({ children, className }) => {
                const isInline = !className
                if (isInline) {
                  return (
                    <code className="bg-bg-3 text-fg-1 px-1.5 py-0.5 rounded text-[13px] font-mono">
                      {children}
                    </code>
                  )
                }
                return (
                  <div className="relative my-3">
                    <pre className="bg-bg-3 border border-border rounded-xl p-4 overflow-x-auto">
                      <code className="text-[13px] font-mono text-fg-1">{children}</code>
                    </pre>
                  </div>
                )
              },
              a: ({ children, href }) => (
                <a 
                  href={href} 
                  className="text-amber underline decoration-amber/30 underline-offset-2 hover:decoration-amber/60 transition-colors"
                >
                  {children}
                </a>
              ),
              ul: ({ children }) => (
                <ul className="space-y-2 my-3 text-[15px] text-fg">{children}</ul>
              ),
              ol: ({ children }) => (
                <ol className="space-y-2 my-3 text-[15px] text-fg list-decimal list-inside">{children}</ol>
              ),
              li: ({ children }) => (
                <li className="text-fg-1 leading-[1.6] pl-1">
                  <span className="text-fg">{children}</span>
                </li>
              ),
            }}
          >
            {message.content}
          </ReactMarkdown>
        )}
      </motion.div>

      {/* Inline Card */}
      {message.inlineCard && (
        <motion.div 
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, type: 'spring', stiffness: 260, damping: 28 }}
          className={`w-full max-w-[85%] md:max-w-[75%] ${isLuis ? 'pr-0' : 'pl-0'} mt-2`}
        >
          <InlineCard
            type={message.inlineCard.type}
            summary={message.inlineCard.summary}
            data={message.inlineCard.data}
            timestamp={message.timestamp.toISOString()}
          />
        </motion.div>
      )}

      {/* Confirm Trade Dialog */}
      {message.needsConfirmation && onConfirm && onCancel && (
        <motion.div 
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, type: 'spring', stiffness: 260, damping: 28 }}
          className={`w-full max-w-[85%] md:max-w-[75%] ${isLuis ? 'pr-0' : 'pl-0'} mt-2`}
        >
          <ConfirmTradeDialog
            proposal={message.needsConfirmation.proposal}
            onConfirm={onConfirm}
            onCancel={onCancel}
          />
        </motion.div>
      )}

      {/* Timestamp on hover - only render on client */}
      <AnimatePresence>
        {(isHovered || showTimestamp) && formattedTime !== '--:--' && (
          <motion.span
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="text-[11px] font-mono text-fg-3 mt-2 px-1"
            suppressHydrationWarning
          >
            {formattedTime}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function ThinkingBubble() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 28 }}
      className="flex flex-col items-start"
    >
      <div className="flex items-center gap-2 mb-2 ml-1">
        <TanitAvatar size={24} />
        <span className="text-xs font-medium text-amber">Tanit</span>
        <span className="text-[10px] text-fg-3">pensando...</span>
      </div>
      <div className="relative bg-bg-1 border border-amber/10 rounded-2xl px-8 py-6 flex items-center justify-center">
        <div 
          className="absolute inset-0 rounded-2xl opacity-30 pointer-events-none"
          style={{
            background: 'radial-gradient(circle at center, var(--amber-soft) 0%, transparent 70%)',
          }}
        />
        <TanitOrb state="thinking" size="lg" />
      </div>
    </motion.div>
  )
}

export function ChatPanel() {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isThinking, setIsThinking] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [killSwitchActive, setKillSwitchActive] = useState(false)
  const [orbState, setOrbState] = useState<'idle' | 'thinking' | 'streaming'>('idle')
  const [flickerKey, setFlickerKey] = useState(0)
  const [threadId] = useState(() => `thread_${Date.now()}`)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, isThinking, scrollToBottom])

  // Load chat history on mount
  useEffect(() => {
    const loadHistory = async () => {
      try {
        const response = await fetch(`${API_URL}/bot/mastra-history?limit=50&channel=intimate`)
        if (response.ok) {
          const history = await response.json()
          if (Array.isArray(history) && history.length > 0) {
            const formattedMessages: Message[] = history.map((msg: { id?: string; sender_type?: string; content?: string; created_at?: string }, index: number) => ({
              id: msg.id || `hist_${index}`,
              sender: msg.sender_type === 'user' ? 'luis' : 'tanit',
              content: msg.content || '',
              timestamp: new Date(msg.created_at || Date.now()),
            }))
            setMessages(formattedMessages)
          }
        }
      } catch (error) {
        console.log('[v0] Could not load history, starting fresh conversation')
      }
    }
    loadHistory()
  }, [])

  const sendMessage = async (content: string) => {
    if (!content.trim() || isThinking || isStreaming) return

    const userMessage: Message = {
      id: `user_${Date.now()}`,
      sender: 'luis',
      content: content.trim(),
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInputValue('')
    setIsThinking(true)
    setOrbState('thinking')

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }

    try {
      const response = await fetch(`${API_URL}/bot/mastra-chat-stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: content.trim(),
          channel: 'intimate',
          sender_type: 'user',
          resourceId: 'luis',
          threadId: threadId,
        }),
      })

      if (!response.ok) throw new Error('Failed to send message')

      const reader = response.body?.getReader()
      if (!reader) throw new Error('No response stream')

      const decoder = new TextDecoder()
      let tanitResponse = ''
      let messageId = `tanit_${Date.now()}`

      setIsThinking(false)
      setIsStreaming(true)
      setOrbState('streaming')

      // Add empty Tanit message that we'll update
      setMessages((prev) => [...prev, {
        id: messageId,
        sender: 'tanit',
        content: '',
        timestamp: new Date(),
      }])

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              
              if (data.type === 'token' && data.content) {
                tanitResponse += data.content
                setFlickerKey((k) => k + 1)
                
                // Update the message content
                setMessages((prev) => prev.map((msg) => 
                  msg.id === messageId 
                    ? { ...msg, content: tanitResponse }
                    : msg
                ))
              } else if (data.type === 'done') {
                break
              } else if (data.type === 'error') {
                console.error('[v0] Stream error:', data.message)
              }
            } catch {
              // Non-JSON line, ignore
            }
          }
        }
      }

    } catch (error) {
      console.error('[v0] Error sending message:', error)
      
      // Fallback to mock response if API fails
      await new Promise((resolve) => setTimeout(resolve, 1500))
      setOrbState('streaming')

      const fallbackResponse = 'Entendido, Luis. Estoy aqui para ti. ¿En que puedo ayudarte?'
      
      setMessages((prev) => [...prev, {
        id: `tanit_${Date.now()}`,
        sender: 'tanit',
        content: fallbackResponse,
        timestamp: new Date(),
      }])
    } finally {
      setIsThinking(false)
      setIsStreaming(false)
      setOrbState('idle')
    }
  }

  const handleSend = () => sendMessage(inputValue)

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = `${Math.min(e.target.scrollHeight, 150)}px`
  }

  return (
    <div className="flex flex-col h-full max-w-3xl mx-auto relative">
      {/* Sticky Header with Tanit */}
      <div className="sticky top-0 z-10 h-16 backdrop-blur-2xl bg-bg/80 border-b border-border flex items-center justify-between px-5">
        <div className="flex items-center gap-4">
          <TanitAvatar size={44} />
          <div className="flex items-center gap-2">
            <span className="text-[17px] font-semibold text-fg tracking-[-0.02em]">Tanit</span>
            <motion.div
              className="w-2 h-2 rounded-full bg-success"
              animate={{ 
                opacity: [1, 0.4, 1],
                scale: [1, 0.9, 1],
              }}
              transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
            />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <TanitOrb state={orbState} size="sm" flickerKey={flickerKey} />
          <KillSwitchButton
            isActive={killSwitchActive}
            onToggle={setKillSwitchActive}
          />
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-4 py-6 lg:px-6 lg:py-8 space-y-5">
        {messages.length === 0 && !isThinking && (
          <div className="flex flex-col items-center justify-center h-full text-center px-6 py-12">
            <TanitAvatar size={100} />
            <h2 className="text-xl font-semibold text-fg mt-6">Tanit</h2>
          </div>
        )}
        {messages.map((message, index) => (
          <ChatBubble
            key={message.id}
            message={message}
            showTimestamp={index === messages.length - 1}
            onConfirm={() => sendMessage('Si, autorizo')}
            onCancel={() => sendMessage('No, cancela')}
          />
        ))}
        {isThinking && <ThinkingBubble />}
        <div ref={messagesEndRef} />
      </div>

      {/* Composer */}
      <div className="sticky bottom-0 p-4 pb-6">
        <div className="relative backdrop-blur-2xl bg-bg-1/95 border border-border rounded-2xl p-2 flex items-end gap-2 shadow-lg">
          <button
            className="relative p-3 rounded-xl text-fg-3 hover:text-fg-1 hover:bg-bg-2 transition-all duration-200 flex-shrink-0"
            aria-label="Adjuntar imagen"
          >
            <ImageIcon className="w-5 h-5" />
          </button>
          <button
            className="relative p-3 rounded-xl text-fg-3 hover:text-fg-1 hover:bg-bg-2 transition-all duration-200 flex-shrink-0"
            aria-label="Grabar voz"
          >
            <Mic className="w-5 h-5" />
          </button>
          <textarea
            ref={textareaRef}
            value={inputValue}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            placeholder="Hablale a Tanit..."
            rows={1}
            className="relative flex-1 bg-transparent text-fg text-[15px] resize-none outline-none py-3 px-2 
                       placeholder:text-fg-3 min-h-[48px] max-h-[150px] leading-[1.5]"
            style={{ fontSize: '16px' }}
          />
          <motion.button
            onClick={handleSend}
            disabled={!inputValue.trim() || isThinking || isStreaming}
            className={`
              relative w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0
              transition-all duration-300
              ${
                inputValue.trim() && !isThinking && !isStreaming
                  ? 'bg-amber text-white'
                  : 'bg-bg-2 text-fg-3'
              }
            `}
            whileHover={inputValue.trim() && !isThinking ? { scale: 1.02 } : {}}
            whileTap={inputValue.trim() && !isThinking ? { scale: 0.96 } : {}}
            style={{
              boxShadow: inputValue.trim() && !isThinking && !isStreaming
                ? '0 4px 20px var(--amber-glow)' 
                : 'none',
            }}
            aria-label="Enviar mensaje"
          >
            <Send className="w-5 h-5" />
          </motion.button>
        </div>
      </div>
    </div>
  )
}
