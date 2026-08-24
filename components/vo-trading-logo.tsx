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
 * Sello V-TRADING — ASSET OFICIAL de Luis (render 3D cromo + anillo ámbar).
 *
 * REGLA: este es el único logo aprobado. No se redibuja, no se sustituye por
 * una versión "equivalente" en SVG, no se inventan variantes. Se usa el archivo.
 *
 * El PNG conserva su propio fondo negro (idéntico al negro absoluto de la app),
 * así que NO se recorta el fondo: recortar un render 3D deja bordes mordidos.
 * Al fundirse negro sobre negro, se lee como si fuera transparente.
 */
export function VTradingSeal({ size = 40 }: { size?: number }) {
  return (
    <img
      src="/sello-256.jpg"
      width={size}
      height={size}
      alt="V-TRADING"
      className="rounded-full select-none"
      style={{ width: size, height: size, objectFit: 'cover' }}
      draggable={false}
    />
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
              style={{ fontSize: config.word * 0.34, letterSpacing: '0.28em', color: '#A6A6AD', opacity: 0.9 }}
            >
              IA Design Trader
            </span>
          )}
        </div>
      )}
    </motion.div>
  )
}
