'use client'

import { motion, useAnimationControls } from 'framer-motion'
import { useEffect } from 'react'

type OrbState = 'idle' | 'thinking' | 'streaming' | 'error' | 'muted'
type OrbSize = 'sm' | 'md' | 'lg'

interface TanitOrbProps {
  state?: OrbState
  size?: OrbSize
  flickerKey?: number
  className?: string
}

const sizeConfig = {
  sm: { outer: 40, mid: 26, inner: 10 },
  md: { outer: 56, mid: 36, inner: 14 },
  lg: { outer: 72, mid: 48, inner: 18 },
}

export function TanitOrb({ state = 'idle', size = 'md', flickerKey = 0, className = '' }: TanitOrbProps) {
  const config = sizeConfig[size]
  const innerControls = useAnimationControls()

  const isError = state === 'error'
  const isMuted = state === 'muted'
  const isActive = state === 'thinking' || state === 'streaming'
  const isIdle = state === 'idle'

  const accentColor = isError ? '#F43F5E' : '#F59E0B'
  const glowColor = isError ? 'rgba(244, 63, 94, 0.45)' : 'rgba(245, 158, 11, 0.45)'

  // Token flicker effect
  useEffect(() => {
    if (flickerKey > 0 && state === 'streaming') {
      innerControls.start({
        scale: [1, 1.18, 1],
        transition: { duration: 0.08, ease: 'easeOut' },
      })
    }
  }, [flickerKey, state, innerControls])

  // Breathing animation durations
  const breathDuration = state === 'thinking' ? 1.4 : isIdle ? 4 : 2.4
  const haloDuration = state === 'thinking' ? 6 : 12

  return (
    <div
      className={`relative flex items-center justify-center ${className}`}
      style={{
        width: config.outer,
        height: config.outer,
        filter: isMuted ? 'grayscale(1)' : undefined,
        opacity: isMuted ? 0.3 : 1,
      }}
    >
      {/* Outer halo - only visible when active */}
      {isActive && (
        <motion.div
          className="absolute rounded-full"
          style={{
            width: config.outer,
            height: config.outer,
            background: `conic-gradient(from 0deg, ${accentColor}, transparent 50%, ${accentColor})`,
            filter: 'blur(14px)',
            opacity: 0.65,
          }}
          animate={{ rotate: 360 }}
          transition={{
            duration: haloDuration,
            repeat: Infinity,
            ease: 'linear',
          }}
        />
      )}

      {/* Mid ring */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: config.mid,
          height: config.mid,
          background: `radial-gradient(circle, ${accentColor} 0%, transparent 70%)`,
        }}
        animate={{
          scale: [1, 1.06, 1],
          opacity: isIdle ? [0.5, 0.6, 0.5] : [0.7, 1, 0.7],
        }}
        transition={{
          duration: breathDuration,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      {/* Inner core */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: config.inner,
          height: config.inner,
          backgroundColor: '#FFF8E7',
          boxShadow: `0 0 12px ${glowColor}`,
        }}
        animate={
          state === 'streaming'
            ? undefined
            : {
                scale: [1, 1.12, 1],
                opacity: isIdle ? [0.5, 0.7, 0.5] : [0.8, 1, 0.8],
              }
        }
        transition={{
          duration: state === 'thinking' ? 1.2 : isIdle ? 4 : 1.6,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        initial={{ scale: 1 }}
        {...(state === 'streaming' ? { animate: innerControls } : {})}
      />
    </div>
  )
}
