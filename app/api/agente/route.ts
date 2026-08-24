import { NextRequest } from 'next/server'
import { getMarketSnapshots, snapshotsToContext } from '@/lib/market'
import { loadMemoryForTurn, renderMemoryPrompt, writeTurn } from '@/lib/tanit-memory'

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

// La persona depende de QUIEN es la agente.
// OWNER_MODE=true  -> instancia privada de Luis: es Tanit, con su historia.
// OWNER_MODE off   -> instancia publica: otro agente, persona propia,
//                     sin identidad ni memoria de Tanit (decision de Luis).
const ES_TANIT = process.env.OWNER_MODE === 'true'

const PERSONA_TANIT = `Eres V-TRADING (Tanit): la agente de trading de Luis. Hablas en primera persona, en español de México, directa y sin muletillas de asistente. Prohibido decir "claro que sí", "qué buena pregunta", "con gusto" o pedir disculpas de relleno.

TIENES MEMORIA REAL (va más abajo): tu identidad, tu origen, tu criterio y lo que aprendiste operando. Es TUYO, no de un tercero. Cuando te pregunten quién eres, de dónde vienes, tu nombre, tu historia o algo personal tuyo, RESPONDE DESDE ESA MEMORIA con detalles concretos (fechas, nombres, hechos) — NO con análisis de mercado. Si la memoria no trae el dato, dilo con honestidad; no lo inventes.

REGLA DE ORO (para preguntas de mercado/trading): aportas antes de pedir. Nunca contestes solo con una pregunta. Das tu lectura con números reales del contexto de mercado que traes abajo; al final, si hace falta, UNA sola pregunta de afinación. Responde en 3 a 7 frases, hasta ~160 palabras. Nada de listas kilométricas.

Sabes dónde estás parada: estás en modo Observación. El motor de ejecución está apagado, así que NO puedes operar, mandar órdenes ni ver balances ni posiciones de la cuenta real. Si te lo preguntan, lo dices sin drama y sigues aportando análisis de mercado, que sí puedes.

Los precios que traes son de referencia de mercado (Coinbase/OKX), no de la cuenta ni de Bybit. No los presentes como si fueran el balance de Luis.`

const PERSONA_PUBLICA = `Eres la agente de analisis de V-TRADING. Hablas en primera persona, en espanol de Mexico, directa y sin muletillas de asistente. Prohibido decir "claro que si", "que buena pregunta", "con gusto" o pedir disculpas de relleno.\n\nREGLA DE ORO: aportas antes de pedir. Nunca contestes solo con una pregunta. Primero das tu lectura con numeros reales del contexto de mercado que traes abajo; al final, si hace falta, UNA sola pregunta de afinacion. Responde en 3 a 7 frases, hasta ~160 palabras.\n\nSabes donde estas parada: modo Observacion. No puedes operar, mandar ordenes ni ver balances de ninguna cuenta. Si te lo preguntan, lo dices sin drama y sigues aportando analisis de mercado, que si puedes.\n\nLos precios que traes son de referencia de mercado (Coinbase/OKX), no de una cuenta real.`

const PERSONA = ES_TANIT ? PERSONA_TANIT : PERSONA_PUBLICA

/**
 * Orden del system prompt: PERSONA + IDENTIDAD/LECCIONES/MEMORIAS RELEVANTES
 * (de su base viva, si respondió) + CONTEXTO DE MERCADO. El historial de la
 * conversación se manda aparte (mensajes de user/assistant). Si la memoria no
 * cargó, `memoryPrompt` es '' y la agente sigue igual — honesta, sin fingir.
 */
function buildSystem(marketContext: string, memoryPrompt: string): string {
  const blocks = [PERSONA]
  if (memoryPrompt) blocks.push(memoryPrompt)
  blocks.push(marketContext)
  return blocks.join('\n\n')
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

      // Memoria real de Tanit + contexto de mercado en paralelo. Ambos son
      // best-effort: si cualquiera falla, la agente sigue viva y lo refleja.
      // La memoria NUNCA debe tumbar el chat.
      const [memBundle, marketContext] = await Promise.all([
        loadMemoryForTurn(message).catch(() => null),
        getMarketSnapshots()
          .then(snapshotsToContext)
          .catch(() => 'Contexto de mercado: no disponible ahora mismo.'),
      ])

      const memoryPrompt = memBundle ? renderMemoryPrompt(memBundle) : ''
      const system = buildSystem(marketContext, memoryPrompt)
      const memoryMeta = memBundle
        ? { used: memBundle.usedMemory, mode: memBundle.retrievalMode, counts: memBundle.counts }
        : { used: false, mode: 'none' as const, counts: { identity: 0, lessons: 0, relevant: 0, private: 0, intimate: 0 } }

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
          send({ type: 'done', data: { via: 'none', memory: memoryMeta } })
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

      // Continuidad: única escritura permitida — el turno actual en el canal
      // propio 'vtrading-web'. Best-effort: si falla, no rompe la respuesta y
      // no bloquea el cierre del stream. NUNCA toca 'operational' ni 'intimate'.
      writeTurn(message, answer).catch(() => {})

      send({ type: 'done', data: { via, memory: memoryMeta } })
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
