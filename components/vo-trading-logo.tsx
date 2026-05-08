'use client'

import Image from 'next/image'
import { useState } from 'react'
import { motion } from 'framer-motion'

type LogoSize = 'sm' | 'md' | 'lg'

interface VoTradingLogoProps {
  size?: LogoSize
  showTagline?: boolean
  className?: string
}

const sizeConfig = {
  sm: { height: 32, ringSize: 12, imageHeight: 32 },
  md: { height: 56, ringSize: 18, imageHeight: 56 },
  lg: { height: 96, ringSize: 26, imageHeight: 96 },
}

export function VoTradingLogo({ size = 'md', showTagline = true, className = '' }: VoTradingLogoProps) {
  const [imageError, setImageError] = useState(false)
  const config = sizeConfig[size]

  // Try to use the PNG image first - which is the high-quality reference
  if (!imageError) {
    return (
      <motion.div 
        className={`flex flex-col items-center relative ${className}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <div className="relative">
          <Image
            src="/images/vo-trading.png"
            alt="V Trading - IA Design Trader"
            width={config.height * 4}
            height={config.height}
            className="object-contain"
            style={{ height: config.height, width: 'auto', maxWidth: config.height * 4 }}
            onError={() => setImageError(true)}
            priority
          />
          {/* Subtle glow beneath */}
          <div 
            className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-[60%] h-8 opacity-30"
            style={{
              background: 'radial-gradient(ellipse, var(--amber-glow) 0%, transparent 70%)',
              filter: 'blur(12px)',
            }}
          />
        </div>
      </motion.div>
    )
  }

  // Fallback to pure SVG/CSS logo that matches the reference
  return (
    <motion.div 
      className={`flex flex-col items-center ${className}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <div className="flex items-center gap-1 relative">
        {/* V with chrome gradient */}
        <span
          className="font-semibold text-chrome relative"
          style={{
            fontSize: config.height * 0.85,
            lineHeight: 1,
            transform: 'skewX(-2deg)',
            letterSpacing: '-0.02em',
          }}
        >
          V
        </span>

        {/* Amber O ring - the heart */}
        <div
          className="relative flex items-center justify-center mx-0.5"
          style={{
            width: config.ringSize,
            height: config.ringSize,
          }}
        >
          {/* Glow halo */}
          <div
            className="absolute rounded-full"
            style={{
              width: config.ringSize * 2,
              height: config.ringSize * 2,
              background: 'radial-gradient(circle, var(--amber-glow) 0%, transparent 60%)',
              filter: 'blur(8px)',
            }}
          />
          {/* Ring */}
          <div
            className="absolute rounded-full"
            style={{
              width: config.ringSize,
              height: config.ringSize,
              border: '2px solid var(--amber)',
              boxShadow: `
                0 0 16px var(--amber-glow-strong),
                0 0 32px var(--amber-glow),
                inset 0 0 6px var(--amber-glow)
              `,
            }}
          />
        </div>

        {/* Trading text with chrome gradient */}
        <span
          className="font-medium text-chrome"
          style={{
            fontSize: config.height * 0.38,
            lineHeight: 1,
            letterSpacing: '-0.01em',
            marginLeft: config.ringSize * 0.3,
          }}
        >
          Trading
        </span>
      </div>

      {/* Tagline */}
      {showTagline && (
        <span
          className="uppercase font-medium mt-2"
          style={{
            fontSize: config.height * 0.12,
            letterSpacing: '0.25em',
            color: 'var(--amber)',
            opacity: 0.85,
          }}
        >
          IA Design Trader
        </span>
      )}

      {/* Surface reflection */}
      <div
        className="absolute -bottom-6 left-1/2 -translate-x-1/2 w-[80%] h-10 opacity-25"
        style={{
          background: 'radial-gradient(ellipse, var(--amber-glow) 0%, transparent 70%)',
          filter: 'blur(16px)',
        }}
      />
    </motion.div>
  )
}
