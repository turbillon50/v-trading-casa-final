'use client'

import { motion } from 'framer-motion'

export function AmbientBackground() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
      {/* Base gradient - very subtle */}
      <div 
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse 80% 50% at 50% 100%, rgba(245, 166, 35, 0.03) 0%, transparent 50%),
            radial-gradient(ellipse 60% 40% at 0% 50%, rgba(245, 166, 35, 0.015) 0%, transparent 50%),
            radial-gradient(ellipse 60% 40% at 100% 50%, rgba(245, 166, 35, 0.015) 0%, transparent 50%)
          `,
        }}
      />

      {/* Ambient orb - bottom center glow like the logo reflection */}
      <motion.div
        className="absolute left-1/2 bottom-0 -translate-x-1/2 translate-y-1/2"
        style={{
          width: '600px',
          height: '300px',
          background: 'radial-gradient(ellipse, rgba(245, 166, 35, 0.08) 0%, transparent 70%)',
          filter: 'blur(60px)',
        }}
        animate={{
          opacity: [0.5, 0.7, 0.5],
          scale: [1, 1.05, 1],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      {/* Secondary ambient glow */}
      <motion.div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{
          width: '800px',
          height: '800px',
          background: 'radial-gradient(circle, rgba(245, 166, 35, 0.02) 0%, transparent 50%)',
          filter: 'blur(80px)',
        }}
        animate={{
          opacity: [0.3, 0.5, 0.3],
        }}
        transition={{
          duration: 12,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      {/* Subtle noise texture overlay */}
      <div 
        className="absolute inset-0 opacity-[0.012]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          mixBlendMode: 'overlay',
        }}
      />

      {/* Vignette effect */}
      <div 
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse 70% 70% at 50% 50%, transparent 0%, rgba(0,0,0,0.4) 100%)',
        }}
      />
    </div>
  )
}
