'use client'

import { motion, useAnimationControls, useMotionValue, useTransform, animate } from 'framer-motion'
import { useEffect, useRef } from 'react'

type OrbState = 'idle' | 'thinking' | 'streaming' | 'error' | 'muted'
type OrbSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

interface TanitOrbProps {
  state?: OrbState
  size?: OrbSize
  flickerKey?: number
  className?: string
}

const sizeConfig = {
  xs: { container: 24, outer: 24, mid: 16, inner: 6, blur: 8 },
  sm: { container: 36, outer: 36, mid: 24, inner: 8, blur: 10 },
  md: { container: 56, outer: 56, mid: 36, inner: 12, blur: 14 },
  lg: { container: 80, outer: 80, mid: 52, inner: 18, blur: 20 },
  xl: { container: 120, outer: 120, mid: 78, inner: 26, blur: 28 },
}

export function TanitOrb({ state = 'idle', size = 'md', flickerKey = 0, className = '' }: TanitOrbProps) {
  const config = sizeConfig[size]
  const innerControls = useAnimationControls()
  const breathScale = useMotionValue(1)
  const breathOpacity = useMotionValue(0.7)
  const rotationRef = useRef<ReturnType<typeof animate> | null>(null)

  const isError = state === 'error'
  const isMuted = state === 'muted'
  const isActive = state === 'thinking' || state === 'streaming'
  const isIdle = state === 'idle'

  // Colors based on state
  const primaryColor = isError ? '#EF4444' : '#F5A623'
  const secondaryColor = isError ? '#DC2626' : '#FFB340'
  const glowColor = isError ? 'rgba(239, 68, 68, 0.4)' : 'rgba(245, 166, 35, 0.35)'
  const glowColorStrong = isError ? 'rgba(239, 68, 68, 0.6)' : 'rgba(245, 166, 35, 0.55)'
  const coreColor = isError ? '#FCA5A5' : '#FFF8E7'

  // Token flicker effect
  useEffect(() => {
    if (flickerKey > 0 && state === 'streaming') {
      innerControls.start({
        scale: [1, 1.25, 1],
        opacity: [1, 0.8, 1],
        transition: { duration: 0.1, ease: 'easeOut' },
      })
    }
  }, [flickerKey, state, innerControls])

  // Breathing animation
  useEffect(() => {
    const duration = state === 'thinking' ? 1.2 : isIdle ? 3.5 : 2
    const scaleRange = state === 'thinking' ? [1, 1.08] : isIdle ? [1, 1.03] : [1, 1.05]
    const opacityRange = isIdle ? [0.5, 0.7] : [0.7, 1]

    const breathAnimation = animate(breathScale, scaleRange, {
      duration,
      repeat: Infinity,
      repeatType: 'reverse',
      ease: 'easeInOut',
    })

    const opacityAnimation = animate(breathOpacity, opacityRange, {
      duration,
      repeat: Infinity,
      repeatType: 'reverse',
      ease: 'easeInOut',
    })

    return () => {
      breathAnimation.stop()
      opacityAnimation.stop()
    }
  }, [state, isIdle, breathScale, breathOpacity])

  const midRingScale = useTransform(breathScale, [1, 1.08], [1, 1.06])
  const midRingOpacity = useTransform(breathOpacity, [0.5, 1], isIdle ? [0.4, 0.6] : [0.6, 0.9])

  return (
    <div
      className={`relative flex items-center justify-center ${className}`}
      style={{
        width: config.container,
        height: config.container,
        filter: isMuted ? 'grayscale(1) brightness(0.5)' : undefined,
        opacity: isMuted ? 0.4 : 1,
      }}
    >
      {/* Ambient glow - always present, subtle */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: config.outer * 1.8,
          height: config.outer * 1.8,
          background: `radial-gradient(circle, ${glowColor} 0%, transparent 70%)`,
          filter: `blur(${config.blur * 1.5}px)`,
        }}
        animate={{
          opacity: isActive ? [0.4, 0.7, 0.4] : [0.2, 0.35, 0.2],
          scale: isActive ? [0.95, 1.05, 0.95] : [0.98, 1.02, 0.98],
        }}
        transition={{
          duration: isActive ? 1.5 : 4,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      {/* Outer rotating halo - only when active */}
      {isActive && (
        <motion.div
          className="absolute rounded-full"
          style={{
            width: config.outer,
            height: config.outer,
            background: `conic-gradient(from 0deg, ${primaryColor}, transparent 30%, transparent 50%, ${secondaryColor}, transparent 80%, ${primaryColor})`,
            filter: `blur(${config.blur}px)`,
          }}
          initial={{ rotate: 0, opacity: 0 }}
          animate={{ 
            rotate: 360, 
            opacity: state === 'thinking' ? 0.8 : 0.6,
          }}
          transition={{
            rotate: {
              duration: state === 'thinking' ? 4 : 8,
              repeat: Infinity,
              ease: 'linear',
            },
            opacity: {
              duration: 0.5,
            },
          }}
        />
      )}

      {/* Secondary rotating ring - counter direction */}
      {state === 'thinking' && (
        <motion.div
          className="absolute rounded-full"
          style={{
            width: config.mid * 1.3,
            height: config.mid * 1.3,
            border: `1px solid ${primaryColor}`,
            opacity: 0.3,
          }}
          animate={{ rotate: -360 }}
          transition={{
            duration: 6,
            repeat: Infinity,
            ease: 'linear',
          }}
        />
      )}

      {/* Mid ring - radial gradient */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: config.mid,
          height: config.mid,
          background: `radial-gradient(circle, ${primaryColor} 0%, ${secondaryColor} 40%, transparent 70%)`,
          scale: midRingScale,
          opacity: midRingOpacity,
        }}
      />

      {/* Inner ring stroke */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: config.inner * 2,
          height: config.inner * 2,
          border: `1.5px solid ${primaryColor}`,
          opacity: 0.4,
        }}
        animate={{
          scale: isActive ? [1, 1.1, 1] : [1, 1.05, 1],
          opacity: [0.3, 0.5, 0.3],
        }}
        transition={{
          duration: isActive ? 1.5 : 3,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      {/* Inner core - the heart */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: config.inner,
          height: config.inner,
          backgroundColor: coreColor,
          boxShadow: `
            0 0 ${config.blur * 0.5}px ${glowColorStrong},
            0 0 ${config.blur}px ${glowColor},
            inset 0 0 ${config.blur * 0.3}px rgba(255, 255, 255, 0.5)
          `,
        }}
        animate={
          state === 'streaming'
            ? innerControls
            : {
                scale: isActive ? [1, 1.15, 1] : [1, 1.08, 1],
                opacity: isIdle ? [0.6, 0.85, 0.6] : [0.85, 1, 0.85],
              }
        }
        transition={
          state === 'streaming'
            ? undefined
            : {
                duration: state === 'thinking' ? 0.8 : isIdle ? 3 : 1.5,
                repeat: Infinity,
                ease: 'easeInOut',
              }
        }
      />

      {/* Surface reflection - subtle */}
      <div
        className="absolute rounded-full"
        style={{
          width: config.inner * 0.6,
          height: config.inner * 0.3,
          background: 'linear-gradient(180deg, rgba(255,255,255,0.6) 0%, transparent 100%)',
          top: '50%',
          transform: 'translateY(-80%)',
          borderRadius: '50%',
          opacity: 0.4,
        }}
      />
    </div>
  )
}
