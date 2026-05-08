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
