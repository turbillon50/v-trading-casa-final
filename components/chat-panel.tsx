'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, Image as ImageIcon, Mic, X, Square, Volume2, Loader2 } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import Image from 'next/image'
import { TanitOrb } from './tanit-orb'
import { KillSwitchButton } from './kill-switch-button'
import { InlineCard } from './inline-card'
import { ConfirmTradeDialog } from './confirm-trade-dialog'
import { API_URL, api } from '@/lib/api'

interface ChatPanelProps {
  threadId?: string | null
}

interface PendingImage {
  base64: string
  mimeType: string
  preview: string  // dataURL para preview
}

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
  message: Message & { imagePreviews?: string[] }
  showTimestamp: boolean
  onConfirm?: () => void
  onCancel?: () => void
}) {
  const [isHovered, setIsHovered] = useState(false)
  const [formattedTime, setFormattedTime] = useState('--:--')
  const [audioState, setAudioState] = useState<'idle' | 'loading' | 'playing'>('idle')
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const isLuis = message.sender === 'luis'

  const handleSpeak = async () => {
    if (audioState === 'playing' && audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      setAudioState('idle')
      return
    }
    try {
      setAudioState('loading')
      const url = await api.synthesizeAudioUrl(message.content, 'nova')
      const audio = new Audio(url)
      audioRef.current = audio
      audio.onplay = () => setAudioState('playing')
      audio.onended = () => setAudioState('idle')
      audio.onerror = () => setAudioState('idle')
      await audio.play()
    } catch {
      setAudioState('idle')
    }
  }

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
          <>
            {/* Image previews adjuntas al mensaje del usuario */}
            {message.imagePreviews && message.imagePreviews.length > 0 && (
              <div className="flex gap-2 mb-3 flex-wrap">
                {message.imagePreviews.map((src, i) => (
                  <img
                    key={i}
                    src={src}
                    alt={`adjunto ${i + 1}`}
                    className="max-h-40 rounded-lg border border-border"
                  />
                ))}
              </div>
            )}
            {message.content && message.content !== '[imagen]' && (
              <p className="text-[15px] text-fg leading-[1.6]">{message.content}</p>
            )}
          </>
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

      {/* Speaker — TTS para que Tanit hable. Solo en sus bubbles, hover. */}
      {!isLuis && message.content && message.content.trim().length > 0 && (
        <button
          onClick={handleSpeak}
          className={`mt-1.5 ml-1 p-1.5 rounded-md text-fg-3 hover:text-amber transition-all ${
            isHovered || audioState !== 'idle' ? 'opacity-100' : 'opacity-0'
          }`}
          aria-label={
            audioState === 'playing'
              ? 'Detener'
              : audioState === 'loading'
                ? 'Cargando voz…'
                : 'Escuchar a Tanit'
          }
          disabled={audioState === 'loading'}
        >
          {audioState === 'loading' ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : audioState === 'playing' ? (
            <Square className="w-3.5 h-3.5 text-amber" />
          ) : (
            <Volume2 className="w-3.5 h-3.5" />
          )}
        </button>
      )}

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

export function ChatPanel({ threadId: propsThreadId }: ChatPanelProps = {}) {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isThinking, setIsThinking] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [killSwitchActive, setKillSwitchActive] = useState(false)
  const [orbState, setOrbState] = useState<'idle' | 'thinking' | 'streaming'>('idle')
  const [flickerKey, setFlickerKey] = useState(0)
  const threadId = propsThreadId ?? 'intimate-main'
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([])
  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, isThinking, scrollToBottom])

  // Load chat history when thread changes. Si threadId está definido,
  // pega a /bot/threads/:id/messages (devuelve mensajes ASC). Cambiar de
  // thread es como abrir otro chat anterior.
  useEffect(() => {
    let cancelled = false
    const loadHistory = async () => {
      try {
        if (!threadId) {
          setMessages([])
          return
        }
        const r = await api.threadMessages(threadId, 200)
        if (cancelled) return
        const formatted: Message[] = (r.messages ?? []).map((m) => ({
          id: String(m.id),
          sender: m.role === 'assistant' ? 'tanit' : 'luis',
          content: m.content,
          timestamp: new Date(m.createdAt),
        }))
        setMessages(formatted)
      } catch {
        if (!cancelled) setMessages([])
      }
    }
    loadHistory()
    return () => {
      cancelled = true
    }
  }, [threadId])

  // ─── IMAGE PICKER ──────────────────────────────────────────────────────
  const handleAttachImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    const promises: Promise<PendingImage | null>[] = Array.from(files)
      .slice(0, 4)
      .map(
        (f) =>
          new Promise((resolve) => {
            const reader = new FileReader()
            reader.onload = () => {
              const result = reader.result as string
              const m = /^data:([^;]+);base64,(.+)$/.exec(result)
              if (!m) {
                resolve(null)
                return
              }
              resolve({
                base64: m[2]!,
                mimeType: m[1] || f.type || 'image/jpeg',
                preview: result,
              })
            }
            reader.onerror = () => resolve(null)
            reader.readAsDataURL(f)
          }),
      )
    Promise.all(promises).then((arr) => {
      const ok = arr.filter((x): x is PendingImage => x !== null)
      setPendingImages((prev) => [...prev, ...ok])
      if (e.target) e.target.value = ''
    })
  }

  const removePendingImage = (idx: number) => {
    setPendingImages((prev) => prev.filter((_, i) => i !== idx))
  }

  // ─── MIC / STT ─────────────────────────────────────────────────────────
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      audioChunksRef.current = []
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      mr.ondataavailable = (ev) => {
        if (ev.data.size > 0) audioChunksRef.current.push(ev.data)
      }
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        const reader = new FileReader()
        reader.onload = async () => {
          const result = reader.result as string
          const m = /^data:[^;]+;base64,(.+)$/.exec(result)
          if (!m) return
          setIsTranscribing(true)
          try {
            const r = await api.transcribeAudio(m[1]!, 'audio/webm')
            if (r.text) {
              setInputValue((prev) => (prev ? prev + ' ' + r.text : r.text))
              // Auto-grow textarea
              requestAnimationFrame(() => {
                if (textareaRef.current) {
                  textareaRef.current.style.height = 'auto'
                  textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
                  textareaRef.current.focus()
                }
              })
            }
          } catch (e) {
            console.error('[chat] transcribe failed', e)
          } finally {
            setIsTranscribing(false)
          }
        }
        reader.readAsDataURL(blob)
      }
      mediaRecorderRef.current = mr
      mr.start()
      setIsRecording(true)
    } catch (e) {
      console.error('[chat] mic permission denied or error', e)
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }

  const sendMessage = async (content: string) => {
    if ((!content.trim() && pendingImages.length === 0) || isThinking || isStreaming) return

    // Snapshot de imágenes pendientes para este envío.
    const imagesForRequest = pendingImages.map((p) => ({
      base64: p.base64,
      mimeType: p.mimeType,
    }))
    const imagePreviewsForMessage = pendingImages.map((p) => p.preview)

    const userMessage: Message = {
      id: `user_${Date.now()}`,
      sender: 'luis',
      content: content.trim() || '[imagen]',
      timestamp: new Date(),
      // Adjuntamos previews al mensaje para mostrarlas en la burbuja
      // (extendemos Message en TypeScript en runtime via spread).
      ...(imagePreviewsForMessage.length > 0 && { imagePreviews: imagePreviewsForMessage }),
    } as Message & { imagePreviews?: string[] }

    setMessages((prev) => [...prev, userMessage])
    setInputValue('')
    setPendingImages([])
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
          message: content.trim() || 'Mira esta imagen y dime qué ves.',
          channel: 'intimate',
          sender_type: 'human_luis',
          resourceId: 'luis',
          threadId: threadId,
          ...(imagesForRequest.length > 0 && { images: imagesForRequest }),
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
                    : msg,
                ))
              } else if (data.type === 'tool_result' && data.tool && data.result) {
                // Tanit invocó una tool y llegó el resultado. Adjuntamos
                // como inlineCard al mensaje en curso.
                const t = String(data.tool).toLowerCase()
                let card: Message['inlineCard'] | undefined
                if (t.includes('balance')) {
                  card = {
                    type: 'balance',
                    summary: `${data.result.testnet ? 'testnet · ' : ''}equity $${(data.result.equity || 0).toFixed(2)}`,
                    data: data.result,
                  }
                } else if (t.includes('posicion') || t.includes('position')) {
                  const posCount = (data.result.positions || []).length
                  card = {
                    type: 'positions',
                    summary: posCount === 0 ? 'sin posiciones' : `${posCount} posición(es)`,
                    data: data.result,
                  }
                } else if (t.includes('precio') || t.includes('price')) {
                  card = {
                    type: 'price',
                    summary: `${data.result.symbol} · $${(data.result.lastPrice || 0).toLocaleString()}`,
                    data: data.result,
                  }
                }
                if (card) {
                  setMessages((prev) => prev.map((msg) =>
                    msg.id === messageId ? { ...msg, inlineCard: card } : msg,
                  ))
                }
              } else if (data.type === 'done') {
                break
              } else if (data.type === 'error') {
                console.error('[chat] stream error:', data.message)
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
        {/* Pending image previews */}
        {pendingImages.length > 0 && (
          <div className="flex gap-2 mb-2 px-2 overflow-x-auto custom-scrollbar">
            {pendingImages.map((img, i) => (
              <div key={i} className="relative flex-shrink-0">
                <img
                  src={img.preview}
                  alt={`adjunto ${i + 1}`}
                  className="h-16 w-16 rounded-lg object-cover border border-border"
                />
                <button
                  onClick={() => removePendingImage(i)}
                  className="absolute -top-1 -right-1 w-5 h-5 bg-bg-2 rounded-full flex items-center justify-center border border-border hover:bg-error/20"
                  aria-label="Quitar imagen"
                >
                  <X className="w-3 h-3 text-fg-2" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleAttachImage}
        />

        <div className="relative backdrop-blur-2xl bg-bg-1/95 border border-border rounded-2xl p-2 flex items-end gap-2 shadow-lg">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="relative p-3 rounded-xl text-fg-3 hover:text-fg-1 hover:bg-bg-2 transition-all duration-200 flex-shrink-0"
            aria-label="Adjuntar imagen"
            type="button"
          >
            <ImageIcon className="w-5 h-5" />
          </button>
          <button
            onClick={isRecording ? stopRecording : startRecording}
            className={`relative p-3 rounded-xl transition-all duration-200 flex-shrink-0 ${
              isRecording
                ? 'bg-error/20 text-error animate-pulse'
                : isTranscribing
                  ? 'bg-amber/15 text-amber'
                  : 'text-fg-3 hover:text-fg-1 hover:bg-bg-2'
            }`}
            aria-label={isRecording ? 'Detener grabación' : 'Grabar voz'}
            type="button"
            disabled={isTranscribing}
          >
            {isTranscribing ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : isRecording ? (
              <Square className="w-5 h-5" />
            ) : (
              <Mic className="w-5 h-5" />
            )}
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
