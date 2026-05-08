'use client'

/**
 * VoiceRecorder — modal de captura de voz estilo voice-mode de Claude/ChatGPT.
 *
 * Flujo:
 *   1. Pides permiso del mic, el modal se abre en estado "recording".
 *   2. Mostramos waveform live (analyser FFT) + timer mm:ss + Tanit orb pulsando.
 *   3. Botón X cancela y descarta el audio. Botón ✓ palomita: detiene grabación,
 *      transcribe en backend (Whisper) y dispara onComplete(text) — el padre
 *      decide qué hacer con el texto (típicamente: setInput + sendMessage).
 *
 * Diseño deliberado: sin botón "stop separado de send". Una sola palomita que
 * cierra-y-envía. Si el usuario quiere descartar, X.
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, X, Loader2 } from 'lucide-react'
import { api } from '@/lib/api'

interface VoiceRecorderProps {
  open: boolean
  onComplete: (transcript: string) => void
  onCancel: () => void
}

const BAR_COUNT = 28

export function VoiceRecorder({ open, onComplete, onCancel }: VoiceRecorderProps) {
  const [phase, setPhase] = useState<'idle' | 'recording' | 'transcribing' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [levels, setLevels] = useState<number[]>(() => Array(BAR_COUNT).fill(0))

  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const rafRef = useRef<number | null>(null)
  const startedAtRef = useRef<number>(0)
  const cancelledRef = useRef<boolean>(false)

  const cleanup = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      try {
        recorderRef.current.stop()
      } catch {
        // ignore
      }
    }
    recorderRef.current = null
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {})
      audioCtxRef.current = null
    }
    analyserRef.current = null
  }, [])

  // ─── start recording when modal opens ─────────────────────────────────
  useEffect(() => {
    if (!open) return
    let aborted = false
    cancelledRef.current = false

    const start = async () => {
      try {
        setPhase('idle')
        setErrorMsg(null)
        setElapsedMs(0)
        setLevels(Array(BAR_COUNT).fill(0))
        chunksRef.current = []

        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        if (aborted) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream

        // Audio analyser para visualización
        const Ctx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        const ctx = new Ctx()
        audioCtxRef.current = ctx
        const source = ctx.createMediaStreamSource(stream)
        const analyser = ctx.createAnalyser()
        analyser.fftSize = 256
        analyser.smoothingTimeConstant = 0.7
        source.connect(analyser)
        analyserRef.current = analyser

        // MediaRecorder
        const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' })
        mr.ondataavailable = (ev) => {
          if (ev.data.size > 0) chunksRef.current.push(ev.data)
        }
        mr.onstop = async () => {
          if (cancelledRef.current) {
            cleanup()
            return
          }
          const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
          if (blob.size < 1000) {
            // Demasiado corto, no transcribir
            setErrorMsg('grabación muy corta')
            setPhase('error')
            cleanup()
            return
          }
          setPhase('transcribing')
          try {
            const reader = new FileReader()
            const base64: string = await new Promise((resolve, reject) => {
              reader.onload = () => {
                const result = reader.result as string
                const m = /^data:[^;]+;base64,(.+)$/.exec(result)
                if (!m) reject(new Error('bad dataURL'))
                else resolve(m[1]!)
              }
              reader.onerror = () => reject(new Error('reader error'))
              reader.readAsDataURL(blob)
            })
            const r = await api.transcribeAudio(base64, 'audio/webm')
            const text = (r.text ?? '').trim()
            if (!text) {
              setErrorMsg('no se entendió audio')
              setPhase('error')
              cleanup()
              return
            }
            cleanup()
            onComplete(text)
          } catch (e) {
            setErrorMsg(e instanceof Error ? e.message : 'error transcribiendo')
            setPhase('error')
            cleanup()
          }
        }
        recorderRef.current = mr
        mr.start()

        startedAtRef.current = Date.now()
        setPhase('recording')

        // RAF loop: timer + niveles
        const buf = new Uint8Array(analyser.frequencyBinCount)
        const tick = () => {
          if (!analyserRef.current) return
          analyserRef.current.getByteFrequencyData(buf)
          // Tomamos N puntos repartidos
          const next: number[] = new Array(BAR_COUNT)
          const step = Math.max(1, Math.floor(buf.length / BAR_COUNT))
          for (let i = 0; i < BAR_COUNT; i++) {
            const v = buf[i * step] ?? 0
            next[i] = v / 255 // 0..1
          }
          setLevels(next)
          setElapsedMs(Date.now() - startedAtRef.current)
          rafRef.current = requestAnimationFrame(tick)
        }
        tick()
      } catch (e) {
        const msg =
          e instanceof Error
            ? e.name === 'NotAllowedError'
              ? 'permiso de mic denegado'
              : e.message
            : 'no se pudo iniciar mic'
        setErrorMsg(msg)
        setPhase('error')
        cleanup()
      }
    }

    start()
    return () => {
      aborted = true
      cancelledRef.current = true
      cleanup()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const handleConfirm = () => {
    if (phase !== 'recording') return
    // detener grabación, onstop disparará la transcripción y onComplete
    if (recorderRef.current && recorderRef.current.state === 'recording') {
      try {
        recorderRef.current.stop()
      } catch {
        // ignore
      }
    }
    setPhase('transcribing')
  }

  const handleCancel = () => {
    cancelledRef.current = true
    cleanup()
    onCancel()
  }

  // Esc cierra/cancela
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleCancel()
      else if (e.key === 'Enter' && phase === 'recording') {
        e.preventDefault()
        handleConfirm()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, phase])

  const formatTime = (ms: number) => {
    const total = Math.floor(ms / 1000)
    const m = Math.floor(total / 60)
    const s = total % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md"
            onClick={handleCancel}
          />

          {/* Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2
                       w-[min(440px,92vw)] rounded-3xl border border-border
                       bg-bg-1/95 backdrop-blur-2xl shadow-2xl p-7"
            role="dialog"
            aria-label="Grabar mensaje de voz"
          >
            {/* Header */}
            <div className="flex flex-col items-center mb-5">
              <motion.div
                className="relative w-20 h-20 rounded-full flex items-center justify-center mb-3"
                animate={
                  phase === 'recording'
                    ? { scale: [1, 1.06, 1] }
                    : { scale: 1 }
                }
                transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
              >
                <div
                  className="absolute inset-0 rounded-full"
                  style={{
                    background:
                      phase === 'recording'
                        ? 'radial-gradient(circle, var(--amber-glow) 0%, transparent 70%)'
                        : 'radial-gradient(circle, var(--amber-soft) 0%, transparent 70%)',
                    filter: 'blur(12px)',
                  }}
                />
                <div
                  className="relative w-14 h-14 rounded-full border-2 border-amber/60 flex items-center justify-center bg-bg-1"
                  style={{
                    boxShadow:
                      phase === 'recording'
                        ? '0 0 24px var(--amber-glow), inset 0 0 12px var(--amber-soft)'
                        : 'inset 0 0 8px var(--amber-soft)',
                  }}
                >
                  <motion.div
                    className="w-3 h-3 rounded-full bg-amber"
                    animate={
                      phase === 'recording'
                        ? { opacity: [1, 0.4, 1], scale: [1, 1.2, 1] }
                        : { opacity: 1 }
                    }
                    transition={{ duration: 1.2, repeat: Infinity }}
                  />
                </div>
              </motion.div>
              <div className="text-[15px] font-medium text-fg">
                {phase === 'recording' && 'Te escucho…'}
                {phase === 'transcribing' && 'Transcribiendo…'}
                {phase === 'error' && (errorMsg ?? 'Algo salió mal')}
                {phase === 'idle' && 'Iniciando mic…'}
              </div>
              {phase === 'recording' && (
                <div className="text-[13px] font-mono text-fg-3 mt-1 tabular-nums">
                  {formatTime(elapsedMs)}
                </div>
              )}
            </div>

            {/* Waveform */}
            <div className="h-20 flex items-center justify-center gap-[3px] mb-6">
              {levels.map((lvl, i) => {
                const minH = 6
                const maxH = 70
                const h =
                  phase === 'recording'
                    ? Math.max(minH, lvl * maxH)
                    : phase === 'transcribing'
                      ? minH + Math.sin((Date.now() / 200) + i) * 4 + 8
                      : minH
                return (
                  <motion.div
                    key={i}
                    className="w-[3px] rounded-full"
                    style={{
                      height: `${h}px`,
                      background:
                        phase === 'recording'
                          ? `var(--amber)`
                          : phase === 'transcribing'
                            ? 'var(--amber-soft)'
                            : 'var(--border)',
                      opacity: phase === 'recording' ? 0.4 + lvl * 0.6 : 0.4,
                    }}
                    transition={{ duration: 0.08 }}
                  />
                )
              })}
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-6">
              <motion.button
                onClick={handleCancel}
                whileTap={{ scale: 0.94 }}
                whileHover={{ scale: 1.04 }}
                disabled={phase === 'transcribing'}
                className="w-14 h-14 rounded-full border border-border bg-bg-2/80
                           text-fg-2 hover:text-fg hover:border-fg-3
                           flex items-center justify-center transition-colors
                           disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="Cancelar"
                title="Cancelar (Esc)"
              >
                <X className="w-6 h-6" strokeWidth={1.8} />
              </motion.button>

              <motion.button
                onClick={handleConfirm}
                whileTap={{ scale: 0.94 }}
                whileHover={phase === 'recording' ? { scale: 1.04 } : {}}
                disabled={phase !== 'recording'}
                className={`relative w-16 h-16 rounded-full flex items-center justify-center
                           transition-all
                           ${
                             phase === 'recording'
                               ? 'bg-amber text-white'
                               : 'bg-bg-2 text-fg-3'
                           }`}
                style={{
                  boxShadow:
                    phase === 'recording'
                      ? '0 6px 24px var(--amber-glow)'
                      : 'none',
                }}
                aria-label="Enviar"
                title="Enviar (Enter)"
              >
                {phase === 'transcribing' ? (
                  <Loader2 className="w-7 h-7 animate-spin" />
                ) : (
                  <Check className="w-7 h-7" strokeWidth={2.2} />
                )}
              </motion.button>
            </div>

            {/* Hint */}
            {phase === 'recording' && (
              <p className="text-center text-[11px] text-fg-3 mt-5 font-mono uppercase tracking-wider">
                palomita = enviar · esc = cancelar
              </p>
            )}
            {phase === 'error' && (
              <button
                onClick={handleCancel}
                className="block mx-auto mt-4 text-[12px] text-amber hover:underline"
              >
                cerrar
              </button>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
