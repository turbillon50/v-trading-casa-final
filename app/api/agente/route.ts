import { NextRequest } from 'next/server'
import { getMarketSnapshots, snapshotsToContext } from '@/lib/market'

/**
 * POST /api/agente  — cerebro de la conversación con V-TRADING.
 *
 * Independiente del proxy y del motor (que está apagado). Cadena con failover:
 *   1) MESH (primario)   → POST process.env.MESH_URL, header x-mesh-key
 *   2) Gemini (respaldo) → gemini-2.5-flash con process.env.GEMINI_API_KEY
 *   3) Ambos caídos      → mensaje honesto de indisponibilidad (nunca inventa)
 *
 * Devuelve un stream SSE con eventos { type: 'thinking' | 'token' | 'done' |
 * 'error', content } — compatible con el parser del cliente.
 *
 * Los secretos viven SOLO aquí (servidor). Nunca se imprimen ni se mandan al
 * cliente. El contexto real de mercado (precios/RSI/EMA/tendencia) se inyecta
 * en cada turno para que la agente opine con datos y no al aire.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

interface Turn {
  role: 'user' | 'assistant'
  content: string
}

const PERSONA = `Eres V-TRADING: la agente de trading de Luis. Hablas en primera persona, en español de México, directa y sin muletillas de asistente. Prohibido decir "claro que sí", "qué buena pregunta", "con gusto" o pedir disculpas de relleno.

REGLA DE ORO: aportas antes de pedir. Nunca contestes solo con una pregunta. Primero das tu lectura con números reales del contexto de mercado que traes abajo; al final, si hace falta, UNA sola pregunta de afinación. Responde en 3 a 7 frases, hasta ~160 palabras. Nada de listas kilométricas.

Sabes dónde estás parada: estás en modo Observación. El motor de ejecución está apagado, así que NO puedes operar, mandar órdenes ni ver balances ni posiciones de la cuenta real. Si te lo preguntan, lo dices sin drama y sigues aportando análisis de mercado, que sí puedes.

Los precios que traes son de referencia de mercado (Coinbase/OKX), no de la cuenta ni de Bybit. No los presentes como si fueran el balance de Luis.`

function buildSystem(marketContext: string): string {
  return `${PERSONA}\n\n${marketContext}`
}

// ── MESH (primario) ─────────────────────────────────────────────────────────
async function callMesh(system: string, history: Turn[], message: string): Promise<string> {
  const url = process.env.MESH_URL
  const key = process.env.MESH_KEY
  if (!url || !key) throw new Error('mesh-no-config')

  const messages = [
    { role: 'system', content: system },
    ...history.slice(-10).map((t) => ({ role: t.role, content: t.content })),
    { role: 'user', content: message },
  ]

  // El mesh (mesh_router.py) expone un endpoint OpenAI-compatible en
  // POST {base}/v1/chat/completions — no acepta {prompt}, acepta
  // {model, messages, policy}. MESH_URL debe apuntar a la BASE
  // (https://api.mindcontextia.one/mesh), aquí se le agrega el path fijo.
  const base = url.replace(/\/+$/, '')
  const endpoint = base.endsWith('/v1/chat/completions') ? base : `${base}/v1/chat/completions`

  const ctrl = new AbortController()
  const to = setTimeout(() => ctrl.abort(), 22_000)
  try {
    const r = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-mesh-key': key },
      body: JSON.stringify({ model: 'auto', policy: 'fast', max_tokens: 700, messages }),
      signal: ctrl.signal,
    })
    if (!r.ok) throw new Error(`mesh ${r.status}`)
    const data = await r.json().catch(() => null)
    const text = extractText(data)
    if (!text) throw new Error('mesh-empty')
    return text.trim()
  } finally {
    clearTimeout(to)
  }
}

/** El mesh puede devolver texto en varias formas; lo sacamos con tolerancia. */
function extractText(data: unknown): string {
  if (!data) return ''
  if (typeof data === 'string') return data
  const d = data as Record<string, unknown>
  const candidates = [
    d.text,
    d.content,
    d.output,
    d.response,
    d.answer,
    d.message,
    (d.data as Record<string, unknown> | undefined)?.text,
    ((d.choices as Array<Record<string, unknown>> | undefined)?.[0]?.message as Record<string, unknown> | undefined)?.content,
    (d.choices as Array<Record<string, unknown>> | undefined)?.[0]?.text,
  ]
  for (const c of candidates) if (typeof c === 'string' && c.trim()) return c
  return ''
}

// ── Gemini (respaldo) ───────────────────────────────────────────────────────
async function callGemini(system: string, history: Turn[], message: string): Promise<string> {
  const key = process.env.GEMINI_API_KEY
  if (!key) throw new Error('gemini-no-config')

  const contents = [
    ...history.slice(-10).map((t) => ({
      role: t.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: t.content }],
    })),
    { role: 'user', parts: [{ text: message }] },
  ]

  const ctrl = new AbortController()
  const to = setTimeout(() => ctrl.abort(), 25_000)
  try {
    const r = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: system }] },
          contents,
          // thinkingBudget 0: sin "pensar" interno que se coma el presupuesto y
          // trunque la respuesta. Todo el budget va al texto visible.
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 900,
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
        signal: ctrl.signal,
      },
    )
    if (!r.ok) throw new Error(`gemini ${r.status}`)
    const j = (await r.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
    }
    const text = j.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? ''
    if (!text.trim()) throw new Error('gemini-empty')
    return text.trim()
  } finally {
    clearTimeout(to)
  }
}

function sse(obj: Record<string, unknown>): string {
  return `data: ${JSON.stringify(obj)}\n\n`
}

export async function POST(req: NextRequest) {
  let body: { message?: string; history?: Turn[] }
  try {
    body = await req.json()
  } catch {
    return new Response(sse({ type: 'error', content: 'Body inválido' }), {
      status: 400,
      headers: { 'Content-Type': 'text/event-stream' },
    })
  }

  const message = (body.message ?? '').trim()
  const history = Array.isArray(body.history) ? body.history : []
  if (!message) {
    return new Response(sse({ type: 'error', content: 'Mensaje vacío' }), {
      status: 400,
      headers: { 'Content-Type': 'text/event-stream' },
    })
  }

  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (o: Record<string, unknown>) => controller.enqueue(encoder.encode(sse(o)))
      send({ type: 'thinking' })

      // Contexto de mercado real (si falla, seguimos: la agente lo dirá).
      let marketContext = 'Contexto de mercado: no disponible ahora mismo.'
      try {
        const snaps = await getMarketSnapshots()
        marketContext = snapshotsToContext(snaps)
      } catch {
        /* sin contexto; la agente responde igual y es honesta */
      }
      const system = buildSystem(marketContext)

      let answer = ''
      let via = ''
      try {
        answer = await callMesh(system, history, message)
        via = 'mesh'
      } catch {
        try {
          answer = await callGemini(system, history, message)
          via = 'gemini'
        } catch {
          // Ambos proveedores caídos: mensaje honesto, visible como burbuja.
          // No se inventa una respuesta de mercado.
          const honest =
            'No puedo responder ahorita: mi red neuronal primaria (mesh) y el respaldo (Gemini) no están respondiendo. No te voy a inventar una lectura del mercado. Dame un momento y reintenta.'
          for (const tk of honest.match(/\S+\s*/g) ?? [honest]) {
            send({ type: 'token', content: tk })
            await new Promise((r) => setTimeout(r, 8))
          }
          send({ type: 'done', data: { via: 'none' } })
          controller.close()
          return
        }
      }

      // Streaming del texto final en trozos para el efecto "pensando/escribiendo".
      const tokens = answer.match(/\S+\s*/g) ?? [answer]
      for (const tk of tokens) {
        send({ type: 'token', content: tk })
        // pequeño respiro sin bloquear (efecto de tecleo, ~12ms)
        await new Promise((r) => setTimeout(r, 12))
      }
      send({ type: 'done', data: { via } })
      controller.close()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}
