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

/**
 * Sello V-TRADING — geometría simple a propósito: una "V" de dos trazos con
 * un nodo (el dato/vela) en la punta. Nada de emblemas barrocos: a 16-28px
 * (sidebar, favicon) un diseño detallado se vuelve una mancha ilegible; este
 * se lee limpio incluso a 16px. Coordenadas idénticas a /public/icon.svg
 * para que el sello de la app y el ícono de instalación sean el MISMO diseño.
 */
export function VTradingSeal({ size = 40 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      fill="none"
      className="vt-seal-glow rounded-full"
      role="img"
      aria-label="V-TRADING"
    >
      <defs>
        <linearGradient id="vt-rose" x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FF2D87" />
          <stop offset="1" stopColor="#FF5BA3" />
        </linearGradient>
        <radialGradient id="vt-halo" cx="0.5" cy="0.46" r="0.42">
          <stop stopColor="#FF2D87" stopOpacity="0.16" />
          <stop offset="1" stopColor="#FF2D87" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect width="512" height="512" rx="112" fill="#000000" />
      <circle cx="256" cy="235" r="150" fill="url(#vt-halo)" />
      <path
        d="M82 144 L246 379 M430 144 L266 379"
        stroke="url(#vt-rose)"
        strokeWidth="69"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="430" cy="144" r="30" fill="#FFFFFF" />
      <circle cx="430" cy="144" r="17" fill="#FF5BA3" />
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
