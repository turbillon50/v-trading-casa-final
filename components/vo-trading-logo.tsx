'use client'

import Image from 'next/image'
import { useState } from 'react'

type LogoSize = 'sm' | 'md' | 'lg'

interface VoTradingLogoProps {
  size?: LogoSize
  showTagline?: boolean
  className?: string
}

const sizeConfig = {
  sm: { vHeight: 28, ringSize: 14, tradingSize: 18, taglineSize: 8, gap: 2 },
  md: { vHeight: 56, ringSize: 20, tradingSize: 36, taglineSize: 10, gap: 4 },
  lg: { vHeight: 96, ringSize: 28, tradingSize: 62, taglineSize: 14, gap: 6 },
}

export function VoTradingLogo({ size = 'md', showTagline = true, className = '' }: VoTradingLogoProps) {
  const [imageError, setImageError] = useState(false)
  const config = sizeConfig[size]

  // Try to use the PNG image first
  if (!imageError) {
    return (
      <div className={`flex flex-col items-center ${className}`}>
        <Image
          src="/images/vo-trading.png"
          alt="V Trading"
          width={config.vHeight * 3}
          height={config.vHeight}
          className="object-contain"
          onError={() => setImageError(true)}
          priority
        />
      </div>
    )
  }

  // Fallback to SVG logo
  return (
    <div className={`flex flex-col items-center ${className}`}>
      <div className="flex items-center" style={{ gap: config.gap }}>
        {/* V with chrome gradient */}
        <svg
          height={config.vHeight}
          viewBox="0 0 60 60"
          fill="none"
          style={{ transform: 'skewX(-2deg)' }}
        >
          <defs>
            <linearGradient id="chrome-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#E8E8EC" />
              <stop offset="25%" stopColor="#9CA0AA" />
              <stop offset="50%" stopColor="#3B3E46" />
              <stop offset="75%" stopColor="#C5C8D0" />
              <stop offset="100%" stopColor="#1A1C20" />
            </linearGradient>
          </defs>
          <text
            x="50%"
            y="50%"
            dominantBaseline="central"
            textAnchor="middle"
            fill="url(#chrome-gradient)"
            style={{
              fontSize: config.vHeight * 0.9,
              fontFamily: 'var(--font-geist-sans), Geist, system-ui',
              fontWeight: 600,
            }}
          >
            V
          </text>
        </svg>

        {/* Amber O ring */}
        <div
          className="relative flex items-center justify-center"
          style={{
            width: config.ringSize,
            height: config.ringSize,
          }}
        >
          <div
            className="absolute rounded-full"
            style={{
              width: config.ringSize,
              height: config.ringSize,
              border: '2px solid #F59E0B',
              boxShadow: '0 0 16px rgba(245,158,11,0.65), inset 0 0 4px rgba(245,158,11,0.45)',
            }}
          />
        </div>

        {/* Trading text with chrome gradient */}
        <svg
          height={config.tradingSize}
          viewBox="0 0 160 40"
          fill="none"
        >
          <defs>
            <linearGradient id="chrome-gradient-trading" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#E8E8EC" />
              <stop offset="25%" stopColor="#9CA0AA" />
              <stop offset="50%" stopColor="#3B3E46" />
              <stop offset="75%" stopColor="#C5C8D0" />
              <stop offset="100%" stopColor="#1A1C20" />
            </linearGradient>
          </defs>
          <text
            x="0"
            y="50%"
            dominantBaseline="central"
            fill="url(#chrome-gradient-trading)"
            style={{
              fontSize: 32,
              fontFamily: 'var(--font-geist-sans), Geist, system-ui',
              fontWeight: 500,
              letterSpacing: '-0.01em',
            }}
          >
            Trading
          </text>
        </svg>
      </div>

      {/* Tagline */}
      {showTagline && (
        <span
          className="uppercase text-amber font-medium mt-1"
          style={{
            fontSize: config.taglineSize,
            letterSpacing: '0.32em',
            opacity: 0.85,
          }}
        >
          IA Design Trader
        </span>
      )}
    </div>
  )
}
