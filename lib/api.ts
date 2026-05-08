/**
 * API client centralizado para V Trading frontend.
 *
 * Apunta al backend de Tanit (Express + Mastra) deployado en Railway.
 * Todos los endpoints son GET salvo el chat-stream (POST + SSE).
 *
 * Override para dev: NEXT_PUBLIC_API_URL en .env.local.
 */

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  'https://tanit-production.up.railway.app/api'

// ─── Types compartidos ──────────────────────────────────────────────────────

export interface PortfolioBalance {
  totalEquity: number
  availableBalance: number
  unrealizedPnl: number
  accountType?: string
  testnet?: boolean
  ts?: string
}

export interface PortfolioPosition {
  symbol: string
  side: 'Buy' | 'Sell'
  size: number
  entryPrice: number
  markPrice: number
  leverage: number
  unrealizedPnl: number
  unrealizedPnlPercent: number
  liquidationPrice: number
  stopLoss?: number | null
  takeProfit?: number | null
}

export interface BalanceSnapshot {
  id: number
  balance: string
  equity: string | null
  available: string | null
  note: string | null
  createdAt: string
}

export interface TanitDecision {
  id: number
  decision_type: string
  symbol: string | null
  context: Record<string, unknown>
  verdict: 'executed' | 'blocked' | 'rejected' | 'needs_confirmation' | string
  thesis: string | null
  modified_params: Record<string, unknown> | null
  executed: boolean
  execution_error: string | null
  latency_ms: number | null
  model_used: string | null
  created_at: string
}

export interface TanitMemoryItem {
  id: number
  category: string
  content: string
  createdAt: string
}

export interface PersonalMemory {
  id: number
  type: string
  title: string
  content: string
  is_private: boolean
  created_at: string
}

export interface TanitState {
  ok: boolean
  state: {
    balance: string | null
    equity: string | null
    available: string | null
    balanceUpdatedAt: string | null
    recentTrades: {
      total: number
      wins: number
      losses: number
      winRate: number
      totalPnl: number
    }
    memoryCount: number
    chatCount: number
    ts: string
  }
}

export interface ChatMessageHistoryItem {
  id: number
  role: 'user' | 'assistant'
  content: string
  senderType: string | null
  channel: string | null
  createdAt: string
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { cache: 'no-store' })
  if (!res.ok) {
    let msg = res.statusText
    try {
      const j = await res.json()
      msg = j.error || j.message || msg
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, msg)
  }
  return res.json() as Promise<T>
}

// ─── Endpoints ──────────────────────────────────────────────────────────────

export const api = {
  state: () => getJson<TanitState>('/tanit/state'),

  balance: () => getJson<PortfolioBalance>('/portfolio/balance'),
  positions: () => getJson<PortfolioPosition[]>('/portfolio/positions'),

  balanceSnapshots: (limit = 200) =>
    getJson<{ ok: boolean; count: number; snapshots: BalanceSnapshot[] }>(
      `/tanit/balance-snapshots?limit=${limit}`,
    ),

  decisions: (limit = 50) =>
    getJson<{ ok: boolean; count: number; decisions: TanitDecision[] }>(
      `/tanit/decisions?limit=${limit}`,
    ),

  personalMemories: () =>
    getJson<{ ok: boolean; count: number; memories: PersonalMemory[] }>(
      '/tanit/personal-memories',
    ),

  memories: (category?: string, limit = 100) => {
    const q = new URLSearchParams()
    if (category) q.set('category', category)
    q.set('limit', String(limit))
    return getJson<{ ok: boolean; count: number; memories: TanitMemoryItem[] }>(
      `/tanit/memories?${q.toString()}`,
    )
  },

  chatHistory: (limit = 50, channel: 'intimate' | 'operational' = 'intimate') =>
    getJson<{
      ok: boolean
      channel: string
      count: number
      messages: ChatMessageHistoryItem[]
    }>(`/bot/mastra-history?limit=${limit}&channel=${channel}`),

  // ─── Threads (estilo ChatGPT/Claude) ────────────────────────────────────
  listThreads: (resourceId = 'luis', limit = 50) =>
    getJson<{
      ok: boolean
      count: number
      threads: ThreadSummary[]
    }>(`/bot/threads?resourceId=${encodeURIComponent(resourceId)}&limit=${limit}`),

  threadMessages: (threadId: string, limit = 200) =>
    getJson<{
      ok: boolean
      threadId: string
      count: number
      messages: ThreadMessage[]
    }>(`/bot/threads/${encodeURIComponent(threadId)}/messages?limit=${limit}`),

  createThread: async (resourceId = 'luis', title?: string) => {
    const res = await fetch(`${API_URL}/bot/threads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resourceId, title }),
    })
    if (!res.ok) throw new ApiError(res.status, res.statusText)
    return res.json() as Promise<{
      ok: boolean
      threadId: string
      resourceId: string
      title: string
    }>
  },

  renameThread: async (threadId: string, title: string) => {
    const res = await fetch(
      `${API_URL}/bot/threads/${encodeURIComponent(threadId)}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      },
    )
    if (!res.ok) throw new ApiError(res.status, res.statusText)
    return res.json() as Promise<{ ok: boolean; thread: { id: string; title: string } }>
  },

  deleteThread: async (threadId: string) => {
    const res = await fetch(
      `${API_URL}/bot/threads/${encodeURIComponent(threadId)}`,
      { method: 'DELETE' },
    )
    if (!res.ok) throw new ApiError(res.status, res.statusText)
    return res.json() as Promise<{ ok: boolean; deleted: number }>
  },

  // ─── Audio ──────────────────────────────────────────────────────────────
  transcribeAudio: async (audioBase64: string, mimeType: string) => {
    const res = await fetch(`${API_URL}/audio/transcribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audio_base64: audioBase64, mimeType }),
    })
    if (!res.ok) throw new ApiError(res.status, res.statusText)
    return res.json() as Promise<{ ok: boolean; text: string }>
  },

  /** Devuelve la URL del MP3 para reproducir directamente con un <audio>. */
  synthesizeAudioUrl: async (text: string, voice = 'nova'): Promise<string> => {
    const res = await fetch(`${API_URL}/audio/synthesize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice }),
    })
    if (!res.ok) throw new ApiError(res.status, res.statusText)
    const blob = await res.blob()
    return URL.createObjectURL(blob)
  },

  // ─── Status del sistema (todas las integraciones) ──────────────────────
  systemStatus: () => getJson<SystemStatus>('/system/status'),

  // ─── Anillo 3 — autonomía operativa ────────────────────────────────────
  activateAutonomy: async (opts?: {
    max_size?: number
    max_leverage?: number
    max_daily_trades?: number
  }) => {
    const res = await fetch(`${API_URL}/admin/autonomy/enable`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // No mandamos secret: el backend confía en Origin = tanit.work
      body: JSON.stringify({ ...(opts ?? {}) }),
    })
    if (!res.ok) {
      let msg = res.statusText
      try {
        const j = await res.json()
        msg = j.error || msg
      } catch {
        /* ignore */
      }
      throw new ApiError(res.status, msg)
    }
    return res.json() as Promise<{
      ok: boolean
      changes: Array<{ field: string; previous: unknown; new_value: unknown }>
      autonomy: AutonomyConfig
    }>
  },

  deactivateAutonomy: async (reason?: string) => {
    const res = await fetch(`${API_URL}/admin/autonomy/disable`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: reason ?? 'desactivada desde la app' }),
    })
    if (!res.ok) throw new ApiError(res.status, res.statusText)
    return res.json() as Promise<{ ok: boolean; autonomy: AutonomyConfig }>
  },

  getAutonomy: () => getJson<{ ok: boolean; autonomy: AutonomyConfig }>('/admin/autonomy'),

  /** Ticker Bybit en vivo para un símbolo (BTC/ETH/SOL/...). */
  ticker: (symbol: string) =>
    getJson<{
      symbol: string
      price: number
      changePercent24h: number
      high24h: number
      low24h: number
      volume24h: number
      markPrice: number
    }>(`/market/ticker?symbol=${encodeURIComponent(symbol)}`),

  /** Sincroniza governance + autonomy con la Tesis 5.1 (sin topes míos viejos). */
  syncThesis: async () => {
    const res = await fetch(`${API_URL}/admin/sync-thesis`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    if (!res.ok) {
      let msg = res.statusText
      try {
        const j = await res.json()
        msg = j.error || msg
      } catch {
        /* ignore */
      }
      throw new ApiError(res.status, msg)
    }
    return res.json() as Promise<{
      ok: boolean
      changes: Array<{ field: string; previous: unknown; new_value: unknown }>
      governance: Record<string, unknown>
      autonomy: AutonomyConfig
      thesis: {
        version: string
        leverage_bands: { entry: string; escalation: string; peak: string }
        sacred_reserve_pct: number
        rr_min: number
        circuit_breaker_pct: number
        consecutive_stops_pause: number
      }
    }>
  },

  // ─── Galería de imágenes generadas ─────────────────────────────────────
  imageGallery: (limit = 50) =>
    getJson<{ ok: boolean; count: number; images: GalleryImage[] }>(
      `/image/gallery?limit=${limit}`,
    ),

  imageUrl: (id: number) => `${API_URL}/image/${id}`,

  deleteImage: async (id: number) => {
    const res = await fetch(`${API_URL}/image/${id}`, { method: 'DELETE' })
    if (!res.ok) throw new ApiError(res.status, res.statusText)
    return res.json() as Promise<{ ok: boolean; deleted: number }>
  },

  // ─── Generación de imagen vía Gemini 2.5 Flash Image ───────────────────
  /**
   * Genera una imagen con Gemini "Nano Banana" a partir de un prompt.
   * Devuelve un objeto con base64 + mimeType + dataURL listo para preview.
   */
  generateImage: async (prompt: string): Promise<GeneratedImage> => {
    const res = await fetch(`${API_URL}/image/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    })
    if (!res.ok) {
      let msg = res.statusText
      try {
        const j = await res.json()
        msg = j.error || msg
      } catch {
        /* ignore */
      }
      throw new ApiError(res.status, msg)
    }
    const blob = await res.blob()
    const mimeType = blob.type || 'image/png'
    const arrayBuffer = await blob.arrayBuffer()
    const bytes = new Uint8Array(arrayBuffer)
    let binary = ''
    const chunk = 0x8000
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)))
    }
    const base64 = btoa(binary)
    return {
      base64,
      mimeType,
      dataURL: `data:${mimeType};base64,${base64}`,
    }
  },
}

export interface GeneratedImage {
  base64: string
  mimeType: string
  dataURL: string
}

export interface GalleryImage {
  id: number
  prompt: string
  mimeType: string
  sizeBytes: number | null
  provider: string | null
  createdAt: string
}

export interface SystemComponent {
  name: string
  ok: boolean
  latencyMs: number | null
  message?: string
  needsAttention?: boolean
  meta?: Record<string, unknown>
}

export interface SystemStatus {
  ok: boolean
  allOk: boolean
  needsAttention: boolean
  ts: string
  latencyMs: number
  components: SystemComponent[]
}

export interface AutonomyConfig {
  enabled: boolean
  mode: 'observe_only' | 'propose_for_approval' | 'execute_with_governance'
  max_autonomous_size_usd: number
  max_autonomous_leverage: number
  max_daily_trades: number
  daily_trade_count: number
  cooldown_minutes_between_trades: number
  paused_until: string | null
  pause_reason: string | null
  last_trade_at: string | null
  require_thesis_citation: boolean
}

export interface ThreadSummary {
  id: string
  resourceId: string
  title: string | null
  createdAt: string
  updatedAt: string
  preview: string | null
  messageCount: number
}

export interface ThreadMessage {
  id: string
  threadId: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
}
