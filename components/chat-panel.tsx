'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, Image as ImageIcon, Mic } from 'lucide-react'
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

// Mock conversation data with fixed timestamps to avoid hydration mismatch
const MOCK_BASE_TIME = new Date('2026-05-08T09:00:00').getTime()

const mockMessages: Message[] = [
  {
    id: '1',
    sender: 'luis',
    content: 'Buenos dias, Tanit. Como va el mercado hoy?',
    timestamp: new Date(MOCK_BASE_TIME),
  },
  {
    id: '2',
    sender: 'tanit',
    content: 'Buenos dias, Luis. El mercado muestra **volatilidad moderada** esta manana. BTC se mantiene en rango de consolidacion entre $67,200 y $68,400. ETH sigue correlacionado pero con menor fuerza relativa.\n\nVeo una oportunidad potencial en un breakout si supera los $68,500 con volumen.',
    timestamp: new Date(MOCK_BASE_TIME + 60000),
  },
  {
    id: '3',
    sender: 'luis',
    content: 'Dame el balance actual',
    timestamp: new Date(MOCK_BASE_TIME + 300000),
  },
  {
    id: '4',
    sender: 'tanit',
    content: 'Aqui tienes el estado de tu cuenta en Bybit testnet:',
    timestamp: new Date(MOCK_BASE_TIME + 305000),
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
    timestamp: new Date(MOCK_BASE_TIME + 600000),
  },
  {
    id: '6',
    sender: 'tanit',
    content: 'Dado el contexto actual, sugiero **esperar confirmacion** del breakout antes de entrar. La estructura del mercado favorece:\n\n1. **Entrada conservadora**: Long en BTC si cierra 4H arriba de $68,500\n2. **Stop loss**: $67,800 (-1%)\n3. **Take profit**: $70,200 (+2.5%)\n\nRatio riesgo/beneficio de 1:2.5. Mantengamos el apalancamiento bajo, maximo 5x.',
    timestamp: new Date(MOCK_BASE_TIME + 608000),
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
      <motion.div
        className={`
          relative max-w-[85%] md:max-w-[75%] rounded-2xl px-5 py-4
          ${isLuis 
            ? 'bg-[#0c0c0c] border border-[#1a1a1a]' 
            : 'bg-gradient-to-br from-[#0a0a0a] to-[#080808] border border-[#151515]'
          }
        `}
        whileHover={{ scale: 1.005 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      >
        {/* Tanit bubble glow effect */}
        {!isLuis && (
          <div 
            className="absolute -inset-px rounded-2xl opacity-30 pointer-events-none"
            style={{
              background: 'linear-gradient(135deg, rgba(245,166,35,0.08) 0%, transparent 50%, transparent 100%)',
            }}
          />
        )}
        
        {isLuis ? (
          <p className="text-[15px] text-[#e5e5e5] leading-[1.6]">{message.content}</p>
        ) : (
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              p: ({ children }) => (
                <p className="text-[15px] text-[#e5e5e5] leading-[1.6] mb-3 last:mb-0">{children}</p>
              ),
              strong: ({ children }) => (
                <strong className="font-medium text-[#fafafa]">{children}</strong>
              ),
              code: ({ children, className }) => {
                const isInline = !className
                if (isInline) {
                  return (
                    <code className="bg-[#1a1a1a] text-[#d4d4d4] px-1.5 py-0.5 rounded text-[13px] font-mono">
                      {children}
                    </code>
                  )
                }
                return (
                  <div className="relative my-3">
                    <pre className="bg-[#0f0f0f] border border-[#1f1f1f] rounded-xl p-4 overflow-x-auto">
                      <code className="text-[13px] font-mono text-[#d4d4d4]">{children}</code>
                    </pre>
                  </div>
                )
              },
              a: ({ children, href }) => (
                <a 
                  href={href} 
                  className="text-[#F5A623] underline decoration-[#F5A623]/30 underline-offset-2 hover:decoration-[#F5A623]/60 transition-colors"
                >
                  {children}
                </a>
              ),
              ul: ({ children }) => (
                <ul className="space-y-2 my-3 text-[15px] text-[#e5e5e5]">{children}</ul>
              ),
              ol: ({ children }) => (
                <ol className="space-y-2 my-3 text-[15px] text-[#e5e5e5] list-decimal list-inside">{children}</ol>
              ),
              li: ({ children }) => (
                <li className="text-[#b4b4b4] leading-[1.6] pl-1">
                  <span className="text-[#e5e5e5]">{children}</span>
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

      {/* Timestamp on hover */}
      <AnimatePresence>
        {(isHovered || showTimestamp) && (
          <motion.span
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="text-[11px] font-mono text-[#525252] mt-2 px-1"
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
      className="flex items-start"
    >
      <div className="relative bg-gradient-to-br from-[#0a0a0a] to-[#080808] border border-[#151515] rounded-2xl px-8 py-6 flex items-center justify-center">
        {/* Subtle glow */}
        <div 
          className="absolute inset-0 rounded-2xl opacity-40 pointer-events-none"
          style={{
            background: 'radial-gradient(circle at center, rgba(245,166,35,0.08) 0%, transparent 70%)',
          }}
        />
        <TanitOrb state="thinking" size="lg" />
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
    await new Promise((resolve) => setTimeout(resolve, 1800))
    setOrbState('streaming')

    // Simulate token streaming
    const response = 'Entendido. Monitoreare el mercado y te avisare cuando se presente la oportunidad. Recuerda que estoy aqui para apoyarte en cada decision.'
    
    for (let i = 0; i < response.length; i += 8) {
      await new Promise((resolve) => setTimeout(resolve, 40))
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
    <div className="flex flex-col h-full max-w-3xl mx-auto relative">
      {/* Ambient background glow from Tanit */}
      <div 
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] pointer-events-none opacity-30"
        style={{
          background: 'radial-gradient(ellipse at center top, rgba(245,166,35,0.08) 0%, transparent 60%)',
          filter: 'blur(60px)',
        }}
      />

      {/* Sticky Header */}
      <div className="sticky top-0 z-10 h-16 backdrop-blur-2xl bg-black/60 border-b border-[#151515] flex items-center justify-between px-5">
        <div className="flex items-center gap-4">
          <div className="relative">
            <TanitOrb state={orbState} size="sm" flickerKey={flickerKey} />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-[15px] font-semibold text-[#fafafa] tracking-[-0.02em]">Tanit</span>
              <motion.div
                className="w-1.5 h-1.5 rounded-full bg-[#22C55E]"
                animate={{ 
                  opacity: [1, 0.4, 1],
                  scale: [1, 0.9, 1],
                }}
                transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
              />
            </div>
            <span className="text-[11px] text-[#525252] font-mono tracking-wide">estratega</span>
          </div>
        </div>
        <KillSwitchButton
          isActive={killSwitchActive}
          onToggle={setKillSwitchActive}
        />
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-4 py-6 lg:px-6 lg:py-8 space-y-5">
        {messages.map((message, index) => (
          <ChatBubble
            key={message.id}
            message={message}
            showTimestamp={index === messages.length - 1}
            onConfirm={() => {
              const confirmMessage: Message = {
                id: Date.now().toString(),
                sender: 'luis',
                content: 'Si, autorizo',
                timestamp: new Date(),
              }
              setMessages((prev) => [...prev, confirmMessage])
            }}
            onCancel={() => {
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
      <div className="sticky bottom-0 p-4 pb-6">
        {/* Composer glow */}
        <div 
          className="absolute inset-x-4 bottom-6 h-20 pointer-events-none opacity-40"
          style={{
            background: 'radial-gradient(ellipse at center bottom, rgba(245,166,35,0.06) 0%, transparent 70%)',
            filter: 'blur(20px)',
          }}
        />
        
        <div className="relative backdrop-blur-2xl bg-[#0a0a0a]/90 border border-[#1a1a1a] rounded-2xl p-2 flex items-end gap-2">
          {/* Inner highlight */}
          <div 
            className="absolute inset-0 rounded-2xl opacity-50 pointer-events-none"
            style={{
              background: 'linear-gradient(180deg, rgba(255,255,255,0.02) 0%, transparent 50%)',
            }}
          />
          
          <button
            className="relative p-3 rounded-xl text-[#525252] hover:text-[#a1a1a1] hover:bg-[#141414] transition-all duration-200 flex-shrink-0"
            aria-label="Adjuntar imagen"
          >
            <ImageIcon className="w-5 h-5" />
          </button>
          <button
            className="relative p-3 rounded-xl text-[#525252] hover:text-[#a1a1a1] hover:bg-[#141414] transition-all duration-200 flex-shrink-0"
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
            className="relative flex-1 bg-transparent text-[#e5e5e5] text-[15px] resize-none outline-none py-3 px-2 
                       placeholder:text-[#404040] min-h-[48px] max-h-[150px] leading-[1.5]"
            style={{ fontSize: '16px' }}
          />
          <motion.button
            onClick={handleSend}
            disabled={!inputValue.trim() || isThinking}
            className={`
              relative w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0
              transition-all duration-300
              ${
                inputValue.trim() && !isThinking
                  ? 'bg-[#F5A623] text-black'
                  : 'bg-[#1a1a1a] text-[#404040]'
              }
            `}
            whileHover={inputValue.trim() && !isThinking ? { scale: 1.02 } : {}}
            whileTap={inputValue.trim() && !isThinking ? { scale: 0.96 } : {}}
            style={{
              boxShadow: inputValue.trim() && !isThinking 
                ? '0 0 20px rgba(245,166,35,0.3), 0 0 40px rgba(245,166,35,0.15)' 
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
