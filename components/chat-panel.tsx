'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, Image as ImageIcon, Mic, Circle } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { TanitOrb } from './tanit-orb'
import { KillSwitchButton } from './kill-switch-button'
import { InlineCard } from './inline-card'
import { ConfirmTradeDialog } from './confirm-trade-dialog'

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

// Mock conversation data
const mockMessages: Message[] = [
  {
    id: '1',
    sender: 'luis',
    content: 'Buenos dias, Tanit. Como va el mercado hoy?',
    timestamp: new Date(Date.now() - 3600000 * 2),
  },
  {
    id: '2',
    sender: 'tanit',
    content: 'Buenos dias, Luis. El mercado muestra **volatilidad moderada** esta manana. BTC se mantiene en rango de consolidacion entre $67,200 y $68,400. ETH sigue correlacionado pero con menor fuerza relativa.\n\nVeo una oportunidad potencial en un breakout si supera los $68,500 con volumen.',
    timestamp: new Date(Date.now() - 3600000 * 1.9),
  },
  {
    id: '3',
    sender: 'luis',
    content: 'Dame el balance actual',
    timestamp: new Date(Date.now() - 3600000),
  },
  {
    id: '4',
    sender: 'tanit',
    content: 'Aqui tienes el estado de tu cuenta en Bybit testnet:',
    timestamp: new Date(Date.now() - 3600000 + 5000),
    inlineCard: {
      type: 'balance',
      summary: 'Balance: $45.81 USDT testnet · disponible $42.30',
      data: {
        equity: 45.81,
        available: 42.30,
        total: 48.25,
        pnl: 1.47,
      },
    },
  },
  {
    id: '5',
    sender: 'luis',
    content: 'Perfecto. Que estrategia recomiendas para hoy?',
    timestamp: new Date(Date.now() - 1800000),
  },
  {
    id: '6',
    sender: 'tanit',
    content: 'Dado el contexto actual, sugiero **esperar confirmacion** del breakout antes de entrar. La estructura del mercado favorece:\n\n1. **Entrada conservadora**: Long en BTC si cierra 4H arriba de $68,500\n2. **Stop loss**: $67,800 (-1%)\n3. **Take profit**: $70,200 (+2.5%)\n\nRatio riesgo/beneficio de 1:2.5. Mantengamos el apalancamiento bajo, maximo 5x.',
    timestamp: new Date(Date.now() - 1800000 + 8000),
  },
]

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
  const isLuis = message.sender === 'luis'

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 280, damping: 30 }}
      className={`flex flex-col ${isLuis ? 'items-end' : 'items-start'}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className={`
          max-w-[78%] rounded-xl px-4 py-3
          ${isLuis ? 'bg-bg-elev' : 'bg-bg-1'}
        `}
      >
        {isLuis ? (
          <p className="text-sm text-fg leading-relaxed">{message.content}</p>
        ) : (
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              p: ({ children }) => (
                <p className="text-sm text-fg leading-relaxed mb-2 last:mb-0">{children}</p>
              ),
              strong: ({ children }) => (
                <strong className="font-medium text-fg">{children}</strong>
              ),
              code: ({ children, className }) => {
                const isInline = !className
                if (isInline) {
                  return (
                    <code className="bg-bg-3 text-fg-1 px-1.5 py-0.5 rounded text-xs font-mono">
                      {children}
                    </code>
                  )
                }
                return (
                  <div className="relative my-2">
                    <pre className="bg-bg-3 rounded-lg p-3 overflow-x-auto">
                      <code className="text-xs font-mono text-fg-1">{children}</code>
                    </pre>
                  </div>
                )
              },
              a: ({ children, href }) => (
                <a href={href} className="text-amber underline hover:no-underline">
                  {children}
                </a>
              ),
              ul: ({ children }) => (
                <ul className="list-disc list-inside space-y-1 mb-2 text-sm text-fg">{children}</ul>
              ),
              ol: ({ children }) => (
                <ol className="list-decimal list-inside space-y-1 mb-2 text-sm text-fg">{children}</ol>
              ),
              li: ({ children }) => <li className="text-fg-1">{children}</li>,
            }}
          >
            {message.content}
          </ReactMarkdown>
        )}
      </div>

      {/* Inline Card */}
      {message.inlineCard && (
        <div className={`w-full max-w-[78%] ${isLuis ? 'pr-0' : 'pl-0'}`}>
          <InlineCard
            type={message.inlineCard.type}
            summary={message.inlineCard.summary}
            data={message.inlineCard.data}
            timestamp={message.timestamp.toISOString()}
          />
        </div>
      )}

      {/* Confirm Trade Dialog */}
      {message.needsConfirmation && onConfirm && onCancel && (
        <div className={`w-full max-w-[78%] ${isLuis ? 'pr-0' : 'pl-0'}`}>
          <ConfirmTradeDialog
            proposal={message.needsConfirmation.proposal}
            onConfirm={onConfirm}
            onCancel={onCancel}
          />
        </div>
      )}

      {/* Timestamp on hover */}
      <AnimatePresence>
        {(isHovered || showTimestamp) && (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-[11px] font-mono text-fg-3 mt-1 px-1"
          >
            {message.timestamp.toLocaleTimeString('es-MX', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function ThinkingBubble() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 280, damping: 30 }}
      className="flex items-start"
    >
      <div className="bg-bg-1 rounded-xl px-6 py-4 flex items-center justify-center">
        <TanitOrb state="thinking" size="md" />
      </div>
    </motion.div>
  )
}

export function ChatPanel() {
  const [messages, setMessages] = useState<Message[]>(mockMessages)
  const [inputValue, setInputValue] = useState('')
  const [isThinking, setIsThinking] = useState(false)
  const [killSwitchActive, setKillSwitchActive] = useState(false)
  const [orbState, setOrbState] = useState<'idle' | 'thinking' | 'streaming'>('idle')
  const [flickerKey, setFlickerKey] = useState(0)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, isThinking])

  const handleSend = async () => {
    if (!inputValue.trim() || isThinking) return

    const userMessage: Message = {
      id: Date.now().toString(),
      sender: 'luis',
      content: inputValue.trim(),
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInputValue('')
    setIsThinking(true)
    setOrbState('thinking')

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }

    // Simulate Tanit response
    await new Promise((resolve) => setTimeout(resolve, 1500))
    setOrbState('streaming')

    // Simulate token streaming
    const response = 'Entendido. Monitoreare el mercado y te avisare cuando se presente la oportunidad. Recuerda que estoy aqui para apoyarte en cada decision.'
    
    for (let i = 0; i < response.length; i += 10) {
      await new Promise((resolve) => setTimeout(resolve, 50))
      setFlickerKey((k) => k + 1)
    }

    const tanitMessage: Message = {
      id: (Date.now() + 1).toString(),
      sender: 'tanit',
      content: response,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, tanitMessage])
    setIsThinking(false)
    setOrbState('idle')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value)
    // Auto-expand textarea
    e.target.style.height = 'auto'
    e.target.style.height = `${Math.min(e.target.scrollHeight, 150)}px`
  }

  return (
    <div className="flex flex-col h-full max-w-3xl mx-auto">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 h-14 glass border-b border-glass-border flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <TanitOrb state={orbState} size="sm" flickerKey={flickerKey} />
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-fg tracking-tight-custom">Tanit</span>
            <motion.div
              className="w-2 h-2 rounded-full bg-success"
              animate={{ opacity: [1, 0.5, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          </div>
        </div>
        <KillSwitchButton
          isActive={killSwitchActive}
          onToggle={setKillSwitchActive}
        />
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 lg:p-6 space-y-4">
        {messages.map((message, index) => (
          <ChatBubble
            key={message.id}
            message={message}
            showTimestamp={index === messages.length - 1}
            onConfirm={() => {
              // Handle confirmation
              const confirmMessage: Message = {
                id: Date.now().toString(),
                sender: 'luis',
                content: 'Si, autorizo',
                timestamp: new Date(),
              }
              setMessages((prev) => [...prev, confirmMessage])
            }}
            onCancel={() => {
              // Handle cancel
              const cancelMessage: Message = {
                id: Date.now().toString(),
                sender: 'luis',
                content: 'No, cancela',
                timestamp: new Date(),
              }
              setMessages((prev) => [...prev, cancelMessage])
            }}
          />
        ))}
        {isThinking && <ThinkingBubble />}
        <div ref={messagesEndRef} />
      </div>

      {/* Composer */}
      <div className="sticky bottom-0 p-4">
        <div className="glass rounded-xl p-2 flex items-end gap-2">
          <button
            className="p-2.5 rounded-lg text-fg-2 hover:text-fg hover:bg-bg-elev transition-colors flex-shrink-0"
            aria-label="Adjuntar imagen"
          >
            <ImageIcon className="w-5 h-5" />
          </button>
          <button
            className="p-2.5 rounded-lg text-fg-2 hover:text-fg hover:bg-bg-elev transition-colors flex-shrink-0"
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
            className="flex-1 bg-transparent text-fg text-sm resize-none outline-none py-2.5 px-1 
                       placeholder:text-fg-3 min-h-[44px] max-h-[150px]"
            style={{ fontSize: '16px' }} // Prevent iOS zoom
          />
          <button
            onClick={handleSend}
            disabled={!inputValue.trim() || isThinking}
            className={`
              w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0
              transition-all duration-200 active:scale-95
              ${
                inputValue.trim() && !isThinking
                  ? 'bg-amber text-black hover:amber-glow'
                  : 'bg-bg-3 text-fg-3'
              }
            `}
            aria-label="Enviar mensaje"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  )
}
