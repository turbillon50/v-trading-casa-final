'use client'

import { useState, useRef, useEffect, useCallback, useLayoutEffect, memo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, Image as ImageIcon, Mic, X, Square, Volume2, Loader2, Sparkles, Phone, Plus, Images as ImagesIcon } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import Image from 'next/image'
import { TanitOrb } from './tanit-orb'
import { KillSwitchButton } from './kill-switch-button'
import { InlineCard } from './inline-card'
import { ConfirmTradeDialog } from './confirm-trade-dialog'
import { VoiceRecorder } from './voice-recorder'
import { VoiceLiveSession } from './voice-live-session'
import { ImageLightbox } from './image-lightbox'
import { ImageGalleryPanel } from './image-gallery-panel'
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

function ChatBubbleImpl({
  message,
  showTimestamp,
  onConfirm,
  onCancel,
  onOpenImage,
}: {
  message: Message & { imagePreviews?: string[] }
  showTimestamp: boolean
  onConfirm?: () => void
  onCancel?: () => void
  onOpenImage?: (src: string) => void
}) {
  const [isHovered, setIsHovered] = useState(false)
  const [formattedTime, setFormattedTime] = useState('--:--')
  const [audioState, setAudioState] = useState<'idle' | 'loading' | 'playing'>('idle')
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const isLuis = message.sender === 'luis'

  const handleSpeak = async () => {
    // Toggle: si ya está reproduciendo, pausar.
    if (audioState === 'playing' && audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      setAudioState('idle')
      return
    }
    // iOS Safari requiere que <audio>.play() ocurra dentro del gesture window
    // (~5s del touch/click). Si tardamos más en fetch+play, iOS rechaza con
    // NotAllowedError. Creamos el elemento sincrónicamente, lo registramos
    // en el ref, y luego llenamos la src con la URL al volver del fetch.
    setAudioState('loading')
    const audio = new Audio()
    audio.preload = 'auto'
    audioRef.current = audio
    audio.onplay = () => setAudioState('playing')
    audio.onended = () => setAudioState('idle')
    audio.onerror = () => setAudioState('idle')
    audio.onpause = () => {
      if (audio.currentTime === 0 || audio.ended) setAudioState('idle')
    }
    try {
      const url = await api.synthesizeAudioUrl(message.content, 'nova')
      audio.src = url
      const p = audio.play()
      if (p && typeof p.then === 'function') {
        p.catch(() => {
          // iOS bloqueó el play (gesture expirada). Mostramos error;
          // el botón vuelve a idle y el siguiente tap funciona.
          setAudioState('idle')
        })
      }
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
    // Antes era motion.div con spring. framer-motion se monta en TODAS las
    // burbujas del thread y suscribe listeners hover/blur — eso multiplicaba
    // el costo de cada reflow del layout cuando Luis tipea en mobile.
    // Cambio a div + CSS fade-in (mucho más barato y visualmente igual).
    <div
      className={`chat-bubble-anim flex flex-col ${isLuis ? 'items-end' : 'items-start'}`}
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

      <div
        className={`
          chat-bubble-content
          relative max-w-[85%] md:max-w-[75%] min-w-0 rounded-2xl px-5 py-4
          ${isLuis
            ? 'bg-bg-2 border border-border'
            : 'bg-bg-1 border border-amber/10'
          }
        `}
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
                  <button
                    key={i}
                    type="button"
                    onClick={() => onOpenImage?.(src)}
                    className="appearance-none p-0 border border-border rounded-lg overflow-hidden hover:opacity-90 active:scale-[0.98] transition-transform"
                    aria-label={`Abrir imagen ${i + 1}`}
                  >
                    <img
                      src={src}
                      alt={`adjunto ${i + 1}`}
                      className="max-h-40 block"
                    />
                  </button>
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
      </div>

      {/* Speaker — TTS para que Tanit hable. Pill grande con texto para
          que sea evidente. Antes era un mini-icon que pasaba desapercibido. */}
      {!isLuis && message.content && message.content.trim().length > 0 && (
        <button
          onClick={handleSpeak}
          className={`mt-2 ml-1 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium transition-all ${
            audioState === 'playing'
              ? 'bg-amber text-white shadow-md'
              : audioState === 'loading'
                ? 'bg-amber-soft text-amber'
                : 'bg-bg-2 text-fg-1 border border-border hover:border-amber hover:text-amber active:scale-95'
          }`}
          aria-label={
            audioState === 'playing'
              ? 'Detener voz'
              : audioState === 'loading'
                ? 'Cargando voz…'
                : 'Escuchar a Tanit'
          }
          disabled={audioState === 'loading'}
        >
          {audioState === 'loading' ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>cargando…</span>
            </>
          ) : audioState === 'playing' ? (
            <>
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>detener</span>
            </>
          ) : (
            <>
              <Volume2 className="w-3.5 h-3.5" />
              <span>escuchar</span>
            </>
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
    </div>
  )
}

// Memoizamos para que cada keystroke en el composer NO redibuje todas las
// burbujas. Solo redibujan cuando cambia el mensaje (id o content por
// streaming) o si la card inline / showTimestamp cambian.
const ChatBubble = memo(ChatBubbleImpl, (prev, next) => {
  if (prev.message.id !== next.message.id) return false
  if (prev.message.content !== next.message.content) return false
  if (prev.showTimestamp !== next.showTimestamp) return false
  if (
    JSON.stringify(prev.message.inlineCard ?? null) !==
    JSON.stringify(next.message.inlineCard ?? null)
  )
    return false
  if (
    JSON.stringify(prev.message.imagePreviews ?? null) !==
    JSON.stringify(next.message.imagePreviews ?? null)
  )
    return false
  return true
})

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
  // hasText es booleano (cambia solo cuando el textarea pasa de vacío a con
  // contenido o viceversa). Antes guardábamos el string completo en state y
  // cada keystroke disparaba un rerender — eso causaba el "clac-clac-clac"
  // de Luis. Ahora el textarea es uncontrolled (DOM directo) y solo
  // notificamos a React en las dos transiciones que importan.
  const [hasText, setHasText] = useState(false)
  const [isThinking, setIsThinking] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [killSwitchActive, setKillSwitchActive] = useState(false)
  const [orbState, setOrbState] = useState<'idle' | 'thinking' | 'streaming'>('idle')
  const [flickerKey, setFlickerKey] = useState(0)
  const threadId = propsThreadId ?? 'intimate-main'
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([])
  const [voiceOpen, setVoiceOpen] = useState(false)
  // Image generation (Gemini Nano Banana)
  const [imageGenOpen, setImageGenOpen] = useState(false)
  const [imageGenPrompt, setImageGenPrompt] = useState('')
  const [imageGenLoading, setImageGenLoading] = useState(false)
  const [imageGenError, setImageGenError] = useState<string | null>(null)
  // Lightbox para abrir imágenes a tamaño completo
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)
  // Galería del baúl
  const [galleryOpen, setGalleryOpen] = useState(false)
  // Conversación de voz en vivo (Gemini Live)
  const [liveOpen, setLiveOpen] = useState(false)
  // Menú "+" del composer (acciones: imagen, generar, dictar, llamar, baúl)
  const [actionsOpen, setActionsOpen] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesScrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  // True si el usuario está cerca del fondo. Solo auto-scroll en ese caso —
  // si Luis está leyendo arriba, no le saltamos la vista al fondo cuando
  // entra un token nuevo.
  const stickToBottomRef = useRef<boolean>(true)
  // Marcamos el primer mount post-thread-change para hacer scroll instantáneo
  // (sin animación) al fondo. Así al abrir un chat aparece pegado al último
  // mensaje en lugar del primero.
  const initialScrollPendingRef = useRef<boolean>(true)

  const scrollToBottom = useCallback((smooth = true) => {
    const el = messagesScrollRef.current
    if (!el) return
    if (smooth) {
      messagesEndRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'end',
      })
    } else {
      // scrollTop directo es instantáneo y no gatilla onScroll smooth.
      el.scrollTop = el.scrollHeight
    }
  }, [])

  // Detectar si está cerca del fondo (margen 120px)
  useEffect(() => {
    const el = messagesScrollRef.current
    if (!el) return
    const onScroll = () => {
      const dist = el.scrollHeight - el.scrollTop - el.clientHeight
      stickToBottomRef.current = dist < 120
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  // Cuando cambia el thread, marcamos la próxima carga de mensajes para
  // que haga jump instantáneo al fondo en lugar de scroll suave desde top.
  useEffect(() => {
    initialScrollPendingRef.current = true
    stickToBottomRef.current = true
  }, [threadId])

  // useLayoutEffect dispara antes de que el browser pinte. Usamos esto para
  // colocar el scroll al fondo SIN flash visible al primer render con
  // mensajes — Luis abre el chat y ve el último mensaje, no el primero.
  useLayoutEffect(() => {
    if (messages.length === 0) return
    if (initialScrollPendingRef.current) {
      initialScrollPendingRef.current = false
      scrollToBottom(false) // instantáneo
    } else if (stickToBottomRef.current) {
      // Mensajes nuevos en la misma sesión + estamos pegados al fondo
      scrollToBottom(true) // suave
    }
  }, [messages, scrollToBottom])

  // Cuando empieza/termina el "thinking" mantener al fondo si estaba pegado
  useEffect(() => {
    if (stickToBottomRef.current) scrollToBottom(true)
  }, [isThinking, scrollToBottom])

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
  // El VoiceRecorder modal maneja grabación + visualización + transcripción.
  // Cuando el usuario palomea, llega el transcript aquí y se ENVÍA directo
  // (sin paso intermedio de "review-and-send" — Luis pidió palomita = subir).
  const handleVoiceComplete = (transcript: string) => {
    setVoiceOpen(false)
    if (transcript.trim()) {
      sendMessage(transcript.trim())
    }
  }

  const handleVoiceCancel = () => setVoiceOpen(false)

  // ─── IMAGE GEN (Gemini Nano Banana) ────────────────────────────────────
  // Genera imagen y la añade a pendingImages como cualquier adjunto. El user
  // puede agregarle texto y enviar, o enviar sola — el composer ya soporta
  // imagen-sin-texto.
  const handleGenerateImage = async () => {
    const p = imageGenPrompt.trim()
    if (!p) return
    setImageGenError(null)
    setImageGenLoading(true)
    try {
      const r = await api.generateImage(p)
      const newImg: PendingImage = {
        base64: r.base64,
        mimeType: r.mimeType,
        preview: r.dataURL,
      }
      setPendingImages((prev) => [...prev, newImg])
      setImageGenOpen(false)
      setImageGenPrompt('')
    } catch (e) {
      setImageGenError(e instanceof Error ? e.message : 'no se pudo generar')
    } finally {
      setImageGenLoading(false)
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
    // Textarea uncontrolled: limpiamos el DOM directo + reseteamos hasText.
    if (textareaRef.current) {
      textareaRef.current.value = ''
      textareaRef.current.style.height = 'auto'
    }
    if (hasText) setHasText(false)
    setPendingImages([])
    setIsThinking(true)
    setOrbState('thinking')

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

  const handleSend = () => {
    const v = textareaRef.current?.value ?? ''
    sendMessage(v)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Textarea uncontrolled: hot path, sólo toca el DOM. Rerender solo cuando
  // pasa de vacío→texto o texto→vacío para que el botón Send se prenda/apague.
  // Resize en rAF (próximo frame) para no bloquear el keystroke con un
  // reflow síncrono de toda la página.
  const resizeRafRef = useRef<number | null>(null)
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const el = e.target
    const v = el.value
    if (resizeRafRef.current != null) cancelAnimationFrame(resizeRafRef.current)
    resizeRafRef.current = requestAnimationFrame(() => {
      el.style.height = 'auto'
      el.style.height = `${Math.min(el.scrollHeight, 150)}px`
    })
    const nowHas = v.trim().length > 0
    if (nowHas !== hasText) setHasText(nowHas)
  }

  return (
    <div className="flex flex-col h-full w-full max-w-3xl mx-auto relative min-w-0 overflow-x-hidden">
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

      {/* Messages Area — `contain: layout paint` aísla el reflow para que
          cuando crezca el textarea NO se relayouten las 200 burbujas. */}
      <div
        ref={messagesScrollRef}
        className="flex-1 min-w-0 w-full overflow-x-hidden overflow-y-auto custom-scrollbar px-4 py-6 lg:px-6 lg:py-8 space-y-5"
        style={{ overscrollBehavior: 'contain', contain: 'layout paint' }}
      >
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
            onOpenImage={(src) => setLightboxSrc(src)}
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
                <button
                  type="button"
                  onClick={() => setLightboxSrc(img.preview)}
                  className="block appearance-none p-0 rounded-lg border border-border hover:opacity-90 active:scale-[0.97] transition-transform"
                  aria-label={`Abrir imagen ${i + 1}`}
                >
                  <img
                    src={img.preview}
                    alt={`adjunto ${i + 1}`}
                    className="h-16 w-16 rounded-lg object-cover"
                  />
                </button>
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

        {/* Image-gen prompt panel (Gemini) — aparece sobre el composer */}
        {imageGenOpen && (
          <div className="mb-2 p-3 rounded-2xl bg-bg-1 border border-amber/30 shadow-lg">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-amber" />
              <span className="text-[12px] font-medium text-fg uppercase tracking-wider">
                Generar imagen
              </span>
              <button
                onClick={() => {
                  setImageGenOpen(false)
                  setImageGenError(null)
                  setImageGenPrompt('')
                  setGalleryOpen(true)
                }}
                className="ml-auto px-2.5 py-1 rounded-md bg-bg-2 hover:bg-bg-3 text-amber text-[11px] font-medium uppercase tracking-wider transition-colors"
                type="button"
                disabled={imageGenLoading}
              >
                ver baúl
              </button>
              <button
                onClick={() => {
                  setImageGenOpen(false)
                  setImageGenError(null)
                  setImageGenPrompt('')
                }}
                className="p-1 rounded text-fg-3 hover:text-fg hover:bg-bg-2"
                aria-label="Cerrar"
                type="button"
                disabled={imageGenLoading}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <textarea
              value={imageGenPrompt}
              onChange={(e) => setImageGenPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  if (!imageGenLoading) handleGenerateImage()
                }
              }}
              placeholder="Describe la imagen (ej: gráfico BTC en estilo cyberpunk, vista de dron de un templo griego al atardecer…)"
              rows={2}
              autoFocus
              disabled={imageGenLoading}
              className="w-full bg-bg-2 text-fg text-[14px] rounded-lg p-2 outline-none resize-none placeholder:text-fg-3"
            />
            {imageGenError && (
              <p className="text-[12px] text-error mt-2">{imageGenError}</p>
            )}
            <div className="flex items-center justify-end gap-2 mt-2">
              <button
                onClick={handleGenerateImage}
                disabled={!imageGenPrompt.trim() || imageGenLoading}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber text-white text-[13px] font-medium disabled:opacity-50"
                type="button"
              >
                {imageGenLoading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    generando…
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    generar
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        <div className="relative backdrop-blur-2xl bg-bg-1/95 border border-border rounded-2xl p-2 flex items-end gap-2 shadow-lg">
          {/* Botón + único que despliega todas las acciones */}
          <div className="relative flex-shrink-0">
            <button
              onClick={() => setActionsOpen((v) => !v)}
              className={`p-3 rounded-xl transition-all duration-200 ${
                actionsOpen
                  ? 'bg-amber-soft text-amber rotate-45'
                  : 'text-fg-2 hover:text-amber hover:bg-bg-2'
              }`}
              aria-label={actionsOpen ? 'Cerrar acciones' : 'Más acciones'}
              type="button"
            >
              <Plus className="w-5 h-5 transition-transform" />
            </button>
            {actionsOpen && (
              <>
                {/* Backdrop para cerrar tocando fuera */}
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setActionsOpen(false)}
                />
                <div
                  className="absolute bottom-full left-0 mb-2 z-40 min-w-[220px]
                             rounded-2xl border border-border bg-bg-1/95 backdrop-blur-2xl
                             shadow-2xl p-1.5 chat-bubble-anim"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setActionsOpen(false)
                      fileInputRef.current?.click()
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-fg hover:bg-bg-2 transition-colors text-left"
                  >
                    <span className="w-8 h-8 rounded-lg bg-bg-2 flex items-center justify-center flex-shrink-0">
                      <ImageIcon className="w-4 h-4 text-fg-1" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-medium">Subir foto</div>
                      <div className="text-[11px] text-fg-3">de tu galería</div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActionsOpen(false)
                      setImageGenOpen(true)
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-fg hover:bg-bg-2 transition-colors text-left"
                  >
                    <span className="w-8 h-8 rounded-lg bg-amber-soft flex items-center justify-center flex-shrink-0">
                      <Sparkles className="w-4 h-4 text-amber" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-medium">Generar imagen</div>
                      <div className="text-[11px] text-fg-3">Imagen 4 (Gemini)</div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActionsOpen(false)
                      setGalleryOpen(true)
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-fg hover:bg-bg-2 transition-colors text-left"
                  >
                    <span className="w-8 h-8 rounded-lg bg-bg-2 flex items-center justify-center flex-shrink-0">
                      <ImagesIcon className="w-4 h-4 text-fg-1" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-medium">Baúl de imágenes</div>
                      <div className="text-[11px] text-fg-3">todas las generadas</div>
                    </div>
                  </button>
                  <div className="my-1 mx-2 border-t border-border" />
                  <button
                    type="button"
                    onClick={() => {
                      setActionsOpen(false)
                      setVoiceOpen(true)
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-fg hover:bg-bg-2 transition-colors text-left"
                  >
                    <span className="w-8 h-8 rounded-lg bg-bg-2 flex items-center justify-center flex-shrink-0">
                      <Mic className="w-4 h-4 text-fg-1" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-medium">Dictar mensaje</div>
                      <div className="text-[11px] text-fg-3">grabar y enviar</div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActionsOpen(false)
                      setLiveOpen(true)
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-fg hover:bg-bg-2 transition-colors text-left"
                  >
                    <span className="w-8 h-8 rounded-lg bg-amber-soft flex items-center justify-center flex-shrink-0">
                      <Phone className="w-4 h-4 text-amber" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-medium">Llamar a Tanit</div>
                      <div className="text-[11px] text-fg-3">conversación de voz en vivo</div>
                    </div>
                  </button>
                </div>
              </>
            )}
          </div>
          <textarea
            ref={textareaRef}
            defaultValue=""
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            placeholder="Hablale a Tanit..."
            rows={1}
            className="relative flex-1 bg-transparent text-fg text-[15px] resize-none outline-none py-3 px-2
                       placeholder:text-fg-3 min-h-[48px] max-h-[150px] leading-[1.5]"
            style={{ fontSize: '16px' }}
          />
          {(() => {
            const canSend =
              (hasText || pendingImages.length > 0) &&
              !isThinking &&
              !isStreaming
            return (
          <motion.button
            onClick={handleSend}
            disabled={!canSend}
            className={`
              relative w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0
              transition-all duration-300
              ${canSend ? 'bg-amber text-white' : 'bg-bg-2 text-fg-3'}
            `}
            whileHover={canSend ? { scale: 1.02 } : {}}
            whileTap={canSend ? { scale: 0.96 } : {}}
            style={{
              boxShadow: canSend ? '0 4px 20px var(--amber-glow)' : 'none',
            }}
            aria-label="Enviar mensaje"
          >
            <Send className="w-5 h-5" />
          </motion.button>
            )
          })()}
        </div>
      </div>

      {/* Voice modal — palomita = transcribir + enviar directo */}
      <VoiceRecorder
        open={voiceOpen}
        onComplete={handleVoiceComplete}
        onCancel={handleVoiceCancel}
      />

      {/* Lightbox para abrir imágenes a tamaño completo */}
      <ImageLightbox
        src={lightboxSrc}
        alt="imagen del chat"
        filename="tanit-imagen.png"
        onClose={() => setLightboxSrc(null)}
      />

      {/* Baúl de imágenes generadas */}
      <ImageGalleryPanel
        open={galleryOpen}
        onClose={() => setGalleryOpen(false)}
      />

      {/* Llamada de voz en vivo (Gemini Live) */}
      <VoiceLiveSession
        open={liveOpen}
        onClose={() => setLiveOpen(false)}
      />
    </div>
  )
}
