import path from 'node:path'

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Silencia el warning de múltiples lockfiles: este worktree es la raíz real.
  turbopack: {
    root: path.dirname(new URL(import.meta.url).pathname),
  },
  // Oculta el overlay de dev para capturas limpias (no afecta producción).
  devIndicators: false,
}

export default nextConfig
