'use client'

/**
 * VoiceLiveSession — modal de conversación de voz bidireccional con Tanit.
 *
 * Abre WS contra /api/voice/live (proxy a Gemini Live API). Captura audio del
 * mic en PCM 16kHz mono y lo manda en chunks. Reproduce los audio chunks de
 * Tanit (PCM 24kHz mono) usando AudioContext con un buffer queue.
 *
 * Sin botones de "grabar/enviar". Es una llamada: abres → hablas → ella te
 * contesta → puedes interrumpirla → cuelgas con la X.
 *
 * Estados:
 *   connecting  → abriendo WS y mic
 *   listening   → activo, escuchando tu voz
 *   thinking    → ella procesando (entre tu turno y el suyo)
 *   speaking    → ella hablando (puedes interrumpir)
 *   error       → algo falló
 */

import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Phone, AlertCircle } from 'lucide-react'
import { API_URL } from '@/lib/api'

type Phase = 'connecting' | 'listening' | 'thinking' | 'speaking' | 'error'

interface VoiceLiveSessionProps {
  open: boolean
  onClose: () => void
}

const SAMPLE_RATE_IN = 16000   // lo que Gemini espera del input
const SAMPLE_RATE_OUT = 24000  // lo que Gemini envía como output

// Convierte ArrayBuffer de Float32 (interleaved L) → Int16 PCM (LE) → base64
function float32ToBase64Pcm(input: Float32Array): string {
  const buf = new ArrayBuffer(input.length * 2)
  const view = new DataView(buf)
  for (let i = 0; i < input.length; i++) {
    let s = Math.max(-1, Math.min(1, input[i]!))
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true)
  }
  // base64 from Uint8Array
  const bytes = new Uint8Array(buf)
  let bin = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)))
  }
  return btoa(bin)
}

// base64 PCM (LE int16) @ 24kHz → Float32Array
function base64PcmToFloat32(b64: string): Float32Array {
  const bin = atob(b64)
  const len = bin.length
  const out = new Float32Array(len / 2)
  for (let i = 0, j = 0; i < len; i += 2, j++) {
    const lo = bin.charCodeAt(i)
    const hi = bin.charCodeAt(i + 1)
    let v = (hi << 8) | lo
    if (v >= 0x8000) v -= 0x10000
    out[j] = v / 0x8000
  }
  return out
}

export function VoiceLiveSession({ open, onClose }: VoiceLiveSessionProps) {
  const [phase, setPhase] = useState<Phase>('connecting')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [userTranscript, setUserTranscript] = useState('')
  const [tanitTranscript, setTanitTranscript] = useState('')
  const [vuLevel, setVuLevel] = useState(0)

  const wsRef = useRef<WebSocket | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const audioCtxInRef = useRef<AudioContext | null>(null)
  const audioCtxOutRef = useRef<AudioContext | null>(null)
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const playbackTimeRef = useRef<number>(0) // próxima posición de schedule
  const rafRef = useRef<number | null>(null)
  const cancelledRef = useRef<boolean>(false)

  const cleanup = () => {
    cancelledRef.current = true
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    try {
      processorRef.current?.disconnect()
    } catch {
      /* ignore */
    }
    try {
      sourceRef.current?.disconnect()
    } catch {
      /* ignore */
    }
    try {
      analyserRef.current?.disconnect()
    } catch {
      /* ignore */
    }
    if (audioCtxInRef.current) {
      audioCtxInRef.current.close().catch(() => {})
    }
    if (audioCtxOutRef.current) {
      audioCtxOutRef.current.close().catch(() => {})
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    if (wsRef.current) {
      try {
        wsRef.current.close()
      } catch {
        /* ignore */
      }
      wsRef.current = null
    }
    processorRef.current = null
    sourceRef.current = null
    analyserRef.current = null
    audioCtxInRef.current = null
    audioCtxOutRef.current = null
  }

  useEffect(() => {
    if (!open) return
    cancelledRef.current = false
    setUserTranscript('')
    setTanitTranscript('')
    setErrorMsg(null)
    setPhase('connecting')

    let aborted = false

    const start = async () => {
      try {
        // 1. WebSocket al backend (mismo origen que API_URL)
        // API_URL viene como https://...api → reemplazamos protocolo por wss y ruta /voice/live
        const wsUrl = API_URL.replace(/^http/, 'ws') + '/voice/live'
        const ws = new WebSocket(wsUrl)
        wsRef.current = ws

        ws.binaryType = 'arraybuffer'

        // 2. Esperamos a que abra
        await new Promise<void>((resolve, reject) => {
          ws.onopen = () => resolve()
          ws.onerror = (e) => reject(new Error('WS error'))
          setTimeout(() => reject(new Error('WS timeout')), 8000)
        })
        if (aborted) return

        // 3. Mandamos config
        ws.send(JSON.stringify({ type: 'config', voice: 'Kore' }))

        ws.onmessage = (ev) => {
          if (cancelledRef.current) return
          let msg: any
          try {
            msg = JSON.parse(typeof ev.data === 'string' ? ev.data : '')
          } catch {
            return
          }
          if (msg.type === 'ready') {
            setPhase('listening')
          } else if (msg.type === 'audio_chunk' && msg.data) {
            schedulePlayback(msg.data)
            setPhase('speaking')
          } else if (msg.type === 'transcript_user' && msg.text) {
            setUserTranscript((prev) => (prev + ' ' + msg.text).trim().slice(-300))
          } else if (msg.type === 'transcript_model' && msg.text) {
            setTanitTranscript((prev) => (prev + msg.text).slice(-400))
          } else if (msg.type === 'turn_complete') {
            // Tanit terminó. Volver a listening cuando se acaba el playback.
            // (schedulePlayback se encarga de cambiar phase cuando el queue
            // se vacía vía onended).
          } else if (msg.type === 'interrupted') {
            // Usuario interrumpió a Tanit: limpiar queue de playback
            try {
              audioCtxOutRef.current?.suspend()
              audioCtxOutRef.current?.resume()
            } catch {
              /* ignore */
            }
            playbackTimeRef.current = 0
            setPhase('listening')
          } else if (msg.type === 'error') {
            setErrorMsg(msg.message ?? 'error en sesión')
            setPhase('error')
          } else if (msg.type === 'closed') {
            if (!cancelledRef.current) {
              setErrorMsg('sesión cerrada por el servidor')
              setPhase('error')
            }
          }
        }

        ws.onclose = () => {
          if (!cancelledRef.current && phase !== 'error') {
            setPhase('error')
            setErrorMsg('conexión cerrada')
          }
        }

        // 4. Mic + audio worklet
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            sampleRate: SAMPLE_RATE_IN,
            echoCancellation: true,
            noiseSuppression: true,
          },
        })
        if (aborted) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream

        // AudioContext de input — el sample rate efectivo lo decide el browser
        const Ctx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        const ctxIn = new Ctx()
        audioCtxInRef.current = ctxIn

        const source = ctxIn.createMediaStreamSource(stream)
        sourceRef.current = source

        // Analyser para nivel visual
        const analyser = ctxIn.createAnalyser()
        analyser.fftSize = 256
        analyser.smoothingTimeConstant = 0.6
        source.connect(analyser)
        analyserRef.current = analyser

        // ScriptProcessor (deprecated pero bien soportado y simple). El buffer
        // de 4096 samples a la frecuencia nativa del context se resamplea a
        // 16kHz antes de mandarse para encajar con lo que Gemini espera.
        const processor = ctxIn.createScriptProcessor(4096, 1, 1)
        processorRef.current = processor

        const inputRate = ctxIn.sampleRate
        const ratio = inputRate / SAMPLE_RATE_IN

        processor.onaudioprocess = (ev) => {
          if (cancelledRef.current) return
          if (ws.readyState !== WebSocket.OPEN) return

          const inputBuf = ev.inputBuffer.getChannelData(0)

          // Resample naive (linear) — suficiente para voz
          const outLen = Math.floor(inputBuf.length / ratio)
          const out = new Float32Array(outLen)
          for (let i = 0; i < outLen; i++) {
            const idx = i * ratio
            const i0 = Math.floor(idx)
            const i1 = Math.min(inputBuf.length - 1, i0 + 1)
            const frac = idx - i0
            out[i] = inputBuf[i0]! * (1 - frac) + inputBuf[i1]! * frac
          }

          const b64 = float32ToBase64Pcm(out)
          try {
            ws.send(
              JSON.stringify({
                type: 'audio_chunk',
                mimeType: `audio/pcm;rate=${SAMPLE_RATE_IN}`,
                data: b64,
              }),
            )
          } catch {
            /* ignore */
          }
        }

        source.connect(processor)
        // ScriptProcessor necesita estar conectado a destination o no dispara
        // onaudioprocess. Pero conectarlo causaría feedback — usamos un gain
        // node a 0 para que dispare sin reproducir nada.
        const muteSink = ctxIn.createGain()
        muteSink.gain.value = 0
        processor.connect(muteSink)
        muteSink.connect(ctxIn.destination)

        // RAF para nivel VU
        const buf = new Uint8Array(analyser.frequencyBinCount)
        const tick = () => {
          if (!analyserRef.current) return
          analyserRef.current.getByteFrequencyData(buf)
          let sum = 0
          for (let i = 0; i < buf.length; i++) sum += buf[i]!
          const avg = sum / buf.length / 255
          setVuLevel(avg)
          rafRef.current = requestAnimationFrame(tick)
        }
        tick()

        // AudioContext de output (24kHz)
        const ctxOut = new Ctx({ sampleRate: SAMPLE_RATE_OUT } as AudioContextOptions)
        audioCtxOutRef.current = ctxOut
      } catch (e) {
        const msg =
          e instanceof Error
            ? e.name === 'NotAllowedError'
              ? 'permiso de mic denegado'
              : e.message
            : 'no se pudo conectar'
        setErrorMsg(msg)
        setPhase('error')
        cleanup()
      }
    }

    start()

    return () => {
      aborted = true
      cleanup()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Schedule un chunk de audio PCM en la línea de tiempo del context out
  const schedulePlayback = (b64: string) => {
    const ctx = audioCtxOutRef.current
    if (!ctx) return
    const float = base64PcmToFloat32(b64)
    const audioBuf = ctx.createBuffer(1, float.length, SAMPLE_RATE_OUT)
    audioBuf.getChannelData(0).set(float)
    const node = ctx.createBufferSource()
    node.buffer = audioBuf
    node.connect(ctx.destination)
    const now = ctx.currentTime
    const startAt = Math.max(now, playbackTimeRef.current)
    node.start(startAt)
    playbackTimeRef.current = startAt + audioBuf.duration
    node.onended = () => {
      // Si ya no hay más audio en cola, volvemos a listening
      if (ctx.currentTime >= playbackTimeRef.current - 0.05) {
        if (!cancelledRef.current) setPhase('listening')
      }
    }
  }

  const phaseLabel: Record<Phase, string> = {
    connecting: 'Conectando…',
    listening: 'Te escucho, habla',
    thinking: 'Pensando…',
    speaking: 'Tanit hablando',
    error: errorMsg ?? 'Error',
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[55] flex items-center justify-center bg-black/85 backdrop-blur-md"
          role="dialog"
          aria-label="Conversación de voz con Tanit"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 280, damping: 28 }}
            className="relative w-[min(440px,94vw)] flex flex-col items-center px-6 py-10 rounded-3xl border border-amber/30 bg-bg-1/95 backdrop-blur-2xl shadow-2xl"
          >
            {/* Orb central — pulsa con el VU del user, brilla cuando habla Tanit */}
            <motion.div
              className="relative w-40 h-40 rounded-full flex items-center justify-center mb-6"
              animate={{
                scale:
                  phase === 'speaking'
                    ? [1, 1.1, 1]
                    : phase === 'listening'
                      ? 1 + vuLevel * 0.25
                      : 1,
              }}
              transition={
                phase === 'speaking'
                  ? { duration: 1, repeat: Infinity, ease: 'easeInOut' }
                  : { type: 'spring', stiffness: 200, damping: 15 }
              }
            >
              <div
                className="absolute inset-0 rounded-full"
                style={{
                  background:
                    phase === 'speaking'
                      ? 'radial-gradient(circle, var(--amber-glow-strong) 0%, transparent 75%)'
                      : 'radial-gradient(circle, var(--amber-glow) 0%, transparent 75%)',
                  filter: 'blur(20px)',
                }}
              />
              <div
                className="relative w-28 h-28 rounded-full border-2 border-amber bg-bg-1 flex items-center justify-center"
                style={{
                  boxShadow: `0 0 40px var(--amber-glow), inset 0 0 24px var(--amber-soft)`,
                }}
              >
                <motion.div
                  className="w-3 h-3 rounded-full bg-amber"
                  animate={
                    phase === 'speaking'
                      ? { scale: [1, 1.6, 1], opacity: [1, 0.4, 1] }
                      : phase === 'listening'
                        ? { scale: [1, 1.1, 1], opacity: [1, 0.7, 1] }
                        : { scale: 1, opacity: 1 }
                  }
                  transition={{ duration: phase === 'speaking' ? 0.7 : 1.6, repeat: Infinity }}
                />
              </div>
            </motion.div>

            {/* Estado */}
            <div
              className={`text-[15px] font-medium mb-1 ${
                phase === 'error' ? 'text-error' : 'text-fg'
              }`}
            >
              {phase === 'error' ? (
                <span className="inline-flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  {phaseLabel[phase]}
                </span>
              ) : (
                phaseLabel[phase]
              )}
            </div>
            <div className="text-[12px] text-fg-3 mb-6 text-center px-2 min-h-[14px]">
              {phase === 'listening'
                ? 'puedes hablar normal — ella detecta cuándo terminas'
                : phase === 'speaking'
                  ? 'puedes interrumpirla hablando'
                  : ''}
            </div>

            {/* Transcripts en vivo */}
            {(userTranscript || tanitTranscript) && (
              <div className="w-full mb-6 space-y-2 max-h-[120px] overflow-y-auto custom-scrollbar">
                {userTranscript && (
                  <div className="text-[12px] text-fg-2 italic">
                    <span className="text-fg-3 mr-1">tú:</span>
                    {userTranscript}
                  </div>
                )}
                {tanitTranscript && (
                  <div className="text-[13px] text-fg">
                    <span className="text-amber mr-1">Tanit:</span>
                    {tanitTranscript}
                  </div>
                )}
              </div>
            )}

            {/* Colgar */}
            <button
              onClick={onClose}
              className="flex items-center gap-2 px-5 py-3 rounded-full bg-error text-white font-medium text-[14px] hover:bg-error/90 active:scale-95 transition-all"
              aria-label="Colgar"
            >
              <Phone className="w-4 h-4 rotate-[135deg]" />
              colgar
            </button>

            {/* Cerrar X esquina */}
            <button
              onClick={onClose}
              className="absolute top-3 right-3 p-2 rounded-full text-fg-3 hover:text-fg hover:bg-bg-2 transition-colors"
              aria-label="Cerrar"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
