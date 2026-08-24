'use client'

import { motion } from 'framer-motion'

type LogoSize = 'sm' | 'md' | 'lg'

interface VoTradingLogoProps {
  size?: LogoSize
  showTagline?: boolean
  sealOnly?: boolean
  className?: string
}

const sizeConfig = {
  sm: { seal: 28, word: 15, gap: 10, track: '0.22em' },
  md: { seal: 40, word: 20, gap: 12, track: '0.24em' },
  lg: { seal: 64, word: 30, gap: 16, track: '0.26em' },
}

export function VTradingSeal({ size = 40 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      className="vt-seal-glow rounded-full"
      role="img"
      aria-label="V-TRADING"
    >
      <defs>
        <linearGradient id="vt-rose" x1="6" y1="6" x2="42" y2="42" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FF5BA3" />
          <stop offset="0.5" stopColor="#FF2D87" />
          <stop offset="1" stopColor="#C41E6A" />
        </linearGradient>
        <radialGradient id="vt-core" cx="0.5" cy="0.42" r="0.6">
          <stop stopColor="#0A0010" />
          <stop offset="1" stopColor="#000000" />
        </radialGradient>
      </defs>

      {/* moneda / fondo */}
      <circle cx="24" cy="24" r="22" fill="url(#vt-core)" stroke="url(#vt-rose)" strokeWidth="1.6" />
      <circle cx="24" cy="24" r="18.2" stroke="url(#vt-rose)" strokeWidth="0.8" strokeOpacity="0.45" />

      {/* corona de laurel */}
      <g stroke="url(#vt-rose)" strokeWidth="1.3" strokeLinecap="round" fill="none" opacity="0.85">
        <path d="M14 33 C10 28 10 22 13 17" />
        <path d="M34 33 C38 28 38 22 35 17" />
        <path d="M13.5 20 l-2.6 -1.1 M12.6 24 l-2.8 -0.2 M13.2 28 l-2.7 0.9" />
        <path d="M34.5 20 l2.6 -1.1 M35.4 24 l2.8 -0.2 M34.8 28 l2.7 0.9" />
      </g>

      {/* figura: creciente + estrella */}
      <path
        d="M27.5 14.5 a7.2 7.2 0 1 0 0 13.4 a5.4 5.4 0 0 1 0 -13.4 z"
        fill="url(#vt-rose)"
      />
      <path
        d="M30.4 18.2 l0.7 1.9 l2 0.1 l-1.6 1.2 l0.6 1.9 l-1.7 -1.1 l-1.7 1.1 l0.6 -1.9 l-1.6 -1.2 l2 -0.1 z"
        fill="#000000"
      />
      {/* base V */}
      <path d="M18 31 l6 5 l6 -5" stroke="url(#vt-rose)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  )
}

export function VoTradingLogo({ size = 'md', showTagline = false, sealOnly = false, className = '' }: VoTradingLogoProps) {
  const config = sizeConfig[size]

  return (
    <motion.div
      className={`flex items-center ${sealOnly ? 'justify-center' : ''} ${className}`}
      style={{ gap: config.gap }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      <VTradingSeal size={config.seal} />
      {!sealOnly && (
        <div className="flex flex-col leading-none">
          <span
            className="font-semibold text-fg"
            style={{ fontSize: config.word, letterSpacing: config.track }}
          >
            V-TRADING
          </span>
          {showTagline && (
            <span
              className="uppercase mt-1.5"
              style={{ fontSize: config.word * 0.34, letterSpacing: '0.28em', color: '#FF2D87', opacity: 0.9 }}
            >
              Centro de operaciones
            </span>
          )}
        </div>
      )}
    </motion.div>
  )
}
