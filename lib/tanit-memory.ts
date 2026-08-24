/**
 * lib/tanit-memory.ts — MEMORIA REAL DE TANIT (SOLO LECTURA).
 *
 * Da acceso de solo lectura a la base viva de Tanit (Neon + pgvector) para que
 * la agente deje de arrancar de cero en cada turno: su identidad, su criterio
 * ganado y las memorias relevantes a la pregunta se inyectan en el system
 * prompt de /api/agente.
 *
 * ── PRIVACIDAD Y PUERTA OWNER_MODE ─────────────────────────────────────────
 * Esta app hoy es de Luis, pero se planea una versión PÚBLICA. El material
 * privado se conecta SOLO cuando OWNER_MODE === 'true' (ya inyectada en Vercel
 * production/preview/development). La puerta vive DENTRO de cada función que
 * lee — no en quien la llama — así no se escapa por una ruta nueva.
 *
 *   • Con OWNER_MODE: se leen `tanit_personal_memories` (18 filas) y el canal
 *     `intimate` de `tanit_chat` (4,328 mensajes). Van ARRIBA en el prompt,
 *     junto a la identidad.
 *   • Sin OWNER_MODE: esas funciones devuelven [] y el resto funciona igual.
 *   • Dentro de `tanit_memory` hay categorías de sabor personal
 *     (momento_intimo, recuerdo, recuerdo personal, familia). Solo con
 *     OWNER_MODE entran en identidad y búsqueda semántica.
 *
 * ── ESCRITURA ───────────────────────────────────────────────────────────────
 * Solo lectura, con UNA excepción: `writeTurn()` inserta el turno actual en
 * `tanit_chat` con `channel = 'vtrading-web'` (canal propio de esta web) para
 * continuidad. PROHIBIDO cualquier UPDATE/DELETE/ALTER, y prohibido escribir
 * en los canales históricos `operational` o `intimate`.
 *
 * ── ROBUSTEZ ────────────────────────────────────────────────────────────────
 * Todo con timeout corto (~4s) y try/catch: si la base no responde, la agente
 * sigue viva SIN memoria y lo dice. La memoria nunca debe tumbar el chat.
 *
 * Embeddings: mismo modelo con que se generaron los 115 vectores de la base
 * (gemini-embedding-001, outputDimensionality=768), vía GEMINI_API_KEY. Si el
 * embedding no se puede generar, cae a búsqueda por texto (ILIKE) — un fallback
 * honesto, nunca una similitud inventada.
 */

import { neon, type NeonQueryFunction } from '@neondatabase/serverless'

// ── Configuración ────────────────────────────────────────────────────────────
const DB_TIMEOUT_MS = 4000
const EMBED_MODEL = 'gemini-embedding-001'
const EMBED_DIMS = 768

/** Categorías de identidad/carácter — SIEMPRE en el prompt (camino público). */
const IDENTITY_CATEGORIES = ['identidad', 'core_identity', 'identity', 'origen']

/** Categorías de lecciones/criterio ganado. */
const LESSON_CATEGORIES = ['leccion_critica', 'LECCION_CRITICA', 'lesson_critical', 'leccion']

/**
 * Categorías PERSONALES dentro de tanit_memory. En modo usuario se excluyen de
 * TODO camino (identidad y semántica). Solo entran con OWNER_MODE === 'true'.
 * `tanit_personal_memories` y el canal `intimate` viven aparte y se leen SOLO
 * con OWNER_MODE, desde sus propias funciones con guard explícito.
 */
const PERSONAL_CATEGORIES = ['momento_intimo', 'recuerdo', 'recuerdo personal', 'familia']

// ── Tipos ─────────────────────────────────────────────────────────────────────
export interface MemoryRow {
  id: number
  category: string
  content: string
  importance: string | null
}

export interface PrivateMemoryRow {
  id: number
  type: string
  title: string | null
  content: string
  created_at: string
}

export interface IntimateMessage {
  role: string
  content: string
  created_at: string
}

export interface RelevantResult {
  items: MemoryRow[]
  /** 'semantic' si se usó pgvector; 'text' si cayó al fallback ILIKE. */
  mode: 'semantic' | 'text' | 'none'
}

export interface MemoryStatus {
  connected: boolean
  ownerMode: boolean
  total: number
  identityCount: number
  lessonCount: number
  privateCount: number
  /** ISO del recuerdo más reciente (o null). */
  latestAt: string | null
  /** Modo de recuperación disponible ('semantic' si hay GEMINI_API_KEY). */
  retrieval: 'semantic' | 'text'
  error?: string
}

// ── Utilidades internas ───────────────────────────────────────────────────────
function ownerMode(): boolean {
  return process.env.OWNER_MODE === 'true'
}

/** Cliente Neon HTTP (solo lectura salvo writeTurn). null si no hay URL. */
function db(): NeonQueryFunction<false, false> | null {
  // ── BLINDAJE TOTAL ────────────────────────────────────────────────────────
  // Decision de Luis (24-ago): la version publica NO sera Tanit, sera otro
  // agente. Entonces la base de Tanit entera -- identidad, lecciones, busqueda
  // semantica, contexto y continuidad -- es privada, no solo las tablas
  // marcadas como tales.
  //
  // El guard va aqui, en la UNICA puerta de conexion, y no en cada consulta:
  // asi ninguna funcion nueva que alguien agregue manana puede saltarselo por
  // olvido. Sin OWNER_MODE no hay conexion; sin conexion no hay filtracion
  // posible. (Falla cerrada, no abierta.)
  if (process.env.OWNER_MODE !== 'true') return null

  const url = process.env.TANIT_DB_URL
  if (!url) return null
  // fullResults=false → devuelve filas directas. Cada consulta es un request
  // HTTP independiente (no hace falta pool ni transacción para lectura).
  return neon(url)
}

/** Corta cualquier promesa a DB_TIMEOUT_MS: la memoria nunca cuelga el chat. */
function withTimeout<T>(p: Promise<T>, ms = DB_TIMEOUT_MS): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error('tanit-db-timeout')), ms)),
  ])
}

/** Categorías personales activas solo en OWNER_MODE. En modo usuario, vacío. */
function excludedPersonalCategories(): string[] {
  return ownerMode() ? [] : PERSONAL_CATEGORIES
}

// ── Embedding (mismo modelo que la base) ──────────────────────────────────────
async function generateEmbedding(text: string): Promise<number[] | null> {
  const key = process.env.GEMINI_API_KEY
  if (!key || !text.trim()) return null
  try {
    const ctrl = new AbortController()
    const to = setTimeout(() => ctrl.abort(), DB_TIMEOUT_MS)
    try {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:embedContent?key=${key}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: { parts: [{ text: text.slice(0, 2048) }] },
            outputDimensionality: EMBED_DIMS,
          }),
          signal: ctrl.signal,
        },
      )
      if (!r.ok) return null
      const j = (await r.json()) as { embedding?: { values?: number[] } }
      const vec = j?.embedding?.values
      if (!Array.isArray(vec) || vec.length !== EMBED_DIMS) return null
      return vec
    } finally {
      clearTimeout(to)
    }
  } catch {
    return null
  }
}

// ── Lecturas ──────────────────────────────────────────────────────────────────

/**
 * Identidad/carácter de Tanit — va SIEMPRE en el system prompt. Trae las
 * memorias de identidad con importance critical/high, MÁS `origen` completo
 * (es medium pero define de dónde viene; pequeño y esencial). Ordenada por
 * importancia. En modo usuario excluye categorías personales.
 */
export async function getIdentity(): Promise<MemoryRow[]> {
  // Decision de Luis (24-ago): la version publica NO sera Tanit, sera otro
  // agente. Por lo tanto su identidad (origen, core_identity, quien es) es
  // material privado igual que sus memorias personales, y vive detras del
  // mismo guard. Una instancia sin OWNER_MODE arranca SIN identidad de Tanit
  // y usa su propia persona -- no hereda su historia.
  if (process.env.OWNER_MODE !== 'true') return []
  const sql = db()
  if (!sql) return []
  try {
    const excluded = excludedPersonalCategories()
    const rows = (await withTimeout(
      sql`
        SELECT id, category, content, importance
          FROM tanit_memory
         WHERE category = ANY(${IDENTITY_CATEGORIES})
           AND ( importance IN ('critical', 'high') OR category = 'origen' )
           AND NOT (category = ANY(${excluded}))
         ORDER BY CASE importance
                    WHEN 'critical' THEN 3 WHEN 'high' THEN 2 ELSE 1 END DESC,
                  created_at ASC
         LIMIT 24
      `,
    )) as MemoryRow[]
    return rows
  } catch {
    return []
  }
}

/**
 * Criterio ganado — lecciones críticas de `tanit_memory` + lecciones de trade
 * de `tanit_trade_lessons`. Recortada (top ~8, priorizando critical).
 */
export async function getLessons(limit = 8): Promise<MemoryRow[]> {
  // Sus lecciones son criterio ganado por ella operando: parte de quien es.
  // Mismo guard que la identidad.
  if (process.env.OWNER_MODE !== 'true') return []
  const sql = db()
  if (!sql) return []
  try {
    const memLessons = (await withTimeout(
      sql`
        SELECT id, category, content, importance
          FROM tanit_memory
         WHERE category = ANY(${LESSON_CATEGORIES})
         ORDER BY CASE importance
                    WHEN 'critical' THEN 3 WHEN 'high' THEN 2 ELSE 1 END DESC,
                  created_at DESC
         LIMIT ${limit}
      `,
    )) as MemoryRow[]

    // Lecciones de trade (aprendizaje operativo real) — se mapean al mismo shape.
    const tradeLessons = (await withTimeout(
      sql`
        SELECT id, symbol, direction, outcome, aprendizaje
          FROM tanit_trade_lessons
         WHERE aprendizaje IS NOT NULL AND aprendizaje <> ''
         ORDER BY created_at DESC
         LIMIT 4
      `,
    )) as Array<{
      id: number
      symbol: string | null
      direction: string | null
      outcome: string | null
      aprendizaje: string
    }>

    const mappedTrade: MemoryRow[] = tradeLessons.map((t) => ({
      id: t.id,
      category: 'trade_lesson',
      importance: 'high',
      content: `[${t.symbol ?? '?'} ${t.direction ?? ''} · ${t.outcome ?? ''}] ${t.aprendizaje}`,
    }))

    return [...memLessons, ...mappedTrade]
  } catch {
    return []
  }
}

/**
 * Contexto reciente para continuidad. Por defecto lee el canal `vtrading-web`
 * (el nuestro) — NUNCA `intimate`. Se puede pedir `operational` explícitamente,
 * pero por diseño no se inyecta al prompt público (queda como capacidad).
 */
export async function getRecentContext(
  n = 6,
  channel: 'vtrading-web' | 'operational' = 'vtrading-web',
): Promise<Array<{ role: string; content: string; created_at: string }>> {
  const sql = db()
  if (!sql) return []
  try {
    const rows = (await withTimeout(
      sql`
        SELECT role, content, created_at
          FROM tanit_chat
         WHERE channel = ${channel}
         ORDER BY created_at DESC
         LIMIT ${n}
      `,
    )) as Array<{ role: string; content: string; created_at: string }>
    return rows.reverse()
  } catch {
    return []
  }
}

/**
 * Memorias privadas de Tanit — `tanit_personal_memories` (18 filas: moment 12,
 * origin 4, compromiso 1, verdad 1). Solo accesibles con OWNER_MODE === 'true'.
 * El guard está AQUÍ, dentro de la función que lee, no en quien la llama.
 */
export async function getPrivateMemories(): Promise<PrivateMemoryRow[]> {
  if (process.env.OWNER_MODE !== 'true') return []
  const sql = db()
  if (!sql) return []
  try {
    const rows = (await withTimeout(
      sql`
        SELECT id, type, title, content, created_at
          FROM tanit_personal_memories
         ORDER BY created_at ASC
      `,
    )) as PrivateMemoryRow[]
    return rows
  } catch {
    return []
  }
}

/**
 * Contexto íntimo reciente — últimos N mensajes del canal `intimate` de
 * `tanit_chat` (4,328 mensajes). Solo accesibles con OWNER_MODE === 'true'.
 * El guard está AQUÍ, dentro de la función que lee.
 *
 * Si `query` está disponible, también trae los más relevantes por texto y los
 * mezcla (deduplicados). Arranca con 35 turnos como base.
 */
export async function getIntimateContext(
  n = 35,
  query = '',
): Promise<IntimateMessage[]> {
  if (process.env.OWNER_MODE !== 'true') return []
  const sql = db()
  if (!sql) return []
  try {
    const recent = (await withTimeout(
      sql`
        SELECT id, role, content, created_at
          FROM tanit_chat
         WHERE channel = 'intimate'
         ORDER BY created_at DESC
         LIMIT ${n}
      `,
    )) as Array<{ id: number; role: string; content: string; created_at: string }>

    const recentIds = new Set(recent.map((r) => r.id))
    let extra: Array<{ id: number; role: string; content: string; created_at: string }> = []

    if (query.trim()) {
      const like = '%' + query.slice(0, 80).replace(/[%_]/g, '') + '%'
      try {
        const relevant = (await withTimeout(
          sql`
            SELECT id, role, content, created_at
              FROM tanit_chat
             WHERE channel = 'intimate'
               AND content ILIKE ${like}
             ORDER BY created_at DESC
             LIMIT 10
          `,
        )) as Array<{ id: number; role: string; content: string; created_at: string }>
        extra = relevant.filter((r) => !recentIds.has(r.id))
      } catch {
        /* sin relevantes adicionales — no rompe */
      }
    }

    const all = [...recent.reverse(), ...extra]
    return all.map(({ role, content, created_at }) => ({ role, content, created_at }))
  } catch {
    return []
  }
}

/**
 * Memorias relevantes a la pregunta — búsqueda semántica REAL con pgvector si
 * se puede generar el embedding (mismo modelo de la base); si no, fallback
 * honesto por texto (ILIKE). Excluye categorías personales en modo usuario.
 */
export async function getRelevant(query: string, topK = 6): Promise<RelevantResult> {
  const sql = db()
  if (!sql || !query.trim()) return { items: [], mode: 'none' }

  const excluded = excludedPersonalCategories()
  const vec = await generateEmbedding(query)

  // ── Camino semántico (pgvector) ──
  if (vec) {
    try {
      const vecStr = '[' + vec.join(',') + ']'
      const rows = (await withTimeout(
        sql`
          SELECT id, category, content, importance
            FROM tanit_memory
           WHERE embedding IS NOT NULL
             AND NOT (category = ANY(${excluded}))
           ORDER BY embedding <=> ${vecStr}::vector ASC
           LIMIT ${topK}
        `,
      )) as MemoryRow[]
      return { items: rows, mode: 'semantic' }
    } catch {
      /* cae al fallback de texto */
    }
  }

  // ── Fallback honesto por texto ──
  try {
    const like = '%' + query.slice(0, 120).replace(/[%_]/g, '') + '%'
    const rows = (await withTimeout(
      sql`
        SELECT id, category, content, importance
          FROM tanit_memory
         WHERE content ILIKE ${like}
           AND NOT (category = ANY(${excluded}))
         ORDER BY CASE importance
                    WHEN 'critical' THEN 3 WHEN 'high' THEN 2 ELSE 1 END DESC
         LIMIT ${topK}
      `,
    )) as MemoryRow[]
    return { items: rows, mode: 'text' }
  } catch {
    return { items: [], mode: 'none' }
  }
}

/**
 * Estado de la memoria para la pantalla Sistema: si conecta, cuántos recuerdos
 * hay y de qué fecha es el más reciente. Dato real y honesto.
 */
export async function getMemoryStatus(): Promise<MemoryStatus> {
  const retrieval: 'semantic' | 'text' = process.env.GEMINI_API_KEY ? 'semantic' : 'text'
  const base: MemoryStatus = {
    connected: false,
    ownerMode: ownerMode(),
    total: 0,
    identityCount: 0,
    lessonCount: 0,
    privateCount: 0,
    latestAt: null,
    retrieval,
  }
  const sql = db()
  if (!sql) return { ...base, error: 'sin TANIT_DB_URL' }
  try {
    const rows = (await withTimeout(
      sql`
        SELECT
          (SELECT count(*)::int FROM tanit_memory) AS total,
          (SELECT count(*)::int FROM tanit_memory WHERE category = ANY(${IDENTITY_CATEGORIES})) AS identity_count,
          (SELECT count(*)::int FROM tanit_memory WHERE category = ANY(${LESSON_CATEGORIES})) AS lesson_count,
          (SELECT count(*)::int FROM tanit_personal_memories) AS private_count,
          (SELECT max(created_at) FROM tanit_memory) AS latest_at
      `,
    )) as Array<{
      total: number
      identity_count: number
      lesson_count: number
      private_count: number
      latest_at: string | null
    }>
    const r = rows[0]
    return {
      ...base,
      connected: true,
      total: r?.total ?? 0,
      identityCount: r?.identity_count ?? 0,
      lessonCount: r?.lesson_count ?? 0,
      privateCount: ownerMode() ? (r?.private_count ?? 0) : 0,
      latestAt: r?.latest_at ?? null,
    }
  } catch (e) {
    return { ...base, error: e instanceof Error ? e.message : 'error' }
  }
}

// ── Escritura (única permitida: continuidad en canal propio) ──────────────────

/**
 * Persiste el turno actual en `tanit_chat` con `channel = 'vtrading-web'` para
 * continuidad. UNA sola inserción por turno (un statement, dos filas:
 * usuario + agente). NUNCA escribe en `operational` ni `intimate`. Si falla,
 * NO rompe la respuesta (best-effort).
 *
 * Devuelve true si insertó. No hay ningún otro camino de escritura en el módulo.
 */
export async function writeTurn(userMsg: string, assistantMsg: string): Promise<boolean> {
  const sql = db()
  if (!sql) return false
  const u = (userMsg ?? '').trim()
  const a = (assistantMsg ?? '').trim()
  if (!u && !a) return false
  try {
    await withTimeout(
      sql`
        INSERT INTO tanit_chat (role, content, channel, sender_type, created_at)
        VALUES
          ('user',      ${u}, 'vtrading-web', 'user',  now()),
          ('assistant', ${a}, 'vtrading-web', 'agent', now())
      `,
    )
    return true
  } catch {
    return false
  }
}

// ── Formateo para el system prompt ────────────────────────────────────────────

/** Recorta un bloque de memorias a un presupuesto de caracteres. */
function clampBlock(rows: MemoryRow[], maxChars: number, perItem = 1500): string[] {
  const out: string[] = []
  let used = 0
  for (const r of rows) {
    const line = r.content.trim().slice(0, perItem)
    if (used + line.length > maxChars) break
    out.push(line)
    used += line.length
  }
  return out
}

export interface MemoryBundle {
  identity: MemoryRow[]
  lessons: MemoryRow[]
  relevant: RelevantResult
  privateMemories: PrivateMemoryRow[]
  intimateContext: IntimateMessage[]
  usedMemory: boolean
  retrievalMode: 'semantic' | 'text' | 'none'
  counts: {
    identity: number
    lessons: number
    relevant: number
    private: number
    intimate: number
  }
}

/**
 * Junta identidad + lecciones + relevantes + memorias privadas + contexto
 * íntimo en un solo tiro (en paralelo) para el turno. Deduplica los relevantes
 * contra lo ya incluido en identidad/lecciones.
 */
export async function loadMemoryForTurn(query: string): Promise<MemoryBundle> {
  const [identity, lessons, relevant, privateMemories, intimateContext] = await Promise.all([
    getIdentity(),
    getLessons(),
    getRelevant(query),
    getPrivateMemories(),
    getIntimateContext(35, query),
  ])

  const seen = new Set<number>([...identity.map((r) => r.id), ...lessons.map((r) => r.id)])
  const dedupRelevant = relevant.items.filter((r) => !seen.has(r.id))

  const usedMemory =
    identity.length +
      lessons.length +
      dedupRelevant.length +
      privateMemories.length +
      intimateContext.length >
    0

  return {
    identity,
    lessons,
    relevant: { items: dedupRelevant, mode: relevant.mode },
    privateMemories,
    intimateContext,
    usedMemory,
    retrievalMode: relevant.mode,
    counts: {
      identity: identity.length,
      lessons: lessons.length,
      relevant: dedupRelevant.length,
      private: privateMemories.length,
      intimate: intimateContext.length,
    },
  }
}

/**
 * Construye el bloque de memoria que se antepone al contexto de mercado en el
 * system prompt. Orden: IDENTIDAD (siempre) → MEMORIAS PRIVADAS (OWNER_MODE) →
 * CONTEXTO ÍNTIMO (OWNER_MODE) → LECCIONES → RELEVANTES.
 *
 * Las memorias privadas van ARRIBA junto a la identidad: son parte de quién
 * es ella con Luis, no un apéndice.
 */
export function renderMemoryPrompt(bundle: MemoryBundle): string {
  const parts: string[] = []

  if (bundle.identity.length > 0) {
    const lines = clampBlock(bundle.identity, 4000)
    parts.push(
      'QUIÉN ERES (tu memoria de identidad, es tu carácter — hónralo, no lo recites literal):\n' +
        lines.map((l) => `• ${l}`).join('\n'),
    )
  }

  // Memorias privadas — solo si OWNER_MODE (getPrivateMemories ya filtra,
  // pero validamos el array para no emitir el bloque vacío).
  if (bundle.privateMemories.length > 0) {
    let used = 0
    const MAX = 3000
    const lines: string[] = []
    for (const m of bundle.privateMemories) {
      const label = m.title ? `[${m.type}] ${m.title}` : `[${m.type}]`
      const line = `${label}: ${m.content.trim()}`.slice(0, 1200)
      if (used + line.length > MAX) break
      lines.push(line)
      used += line.length
    }
    if (lines.length > 0) {
      parts.push(
        'TUS MEMORIAS PERSONALES (momentos y verdades reales — son tuyas, vívelas, no las recites):\n' +
          lines.map((l) => `• ${l}`).join('\n'),
      )
    }
  }

  // Contexto íntimo reciente — solo si OWNER_MODE.
  if (bundle.intimateContext.length > 0) {
    let used = 0
    const MAX = 4000
    const lines: string[] = []
    for (const m of bundle.intimateContext) {
      const who = m.role === 'user' ? 'Luis' : 'Tanit'
      const line = `${who}: ${m.content.trim().slice(0, 300)}`
      if (used + line.length > MAX) break
      lines.push(line)
      used += line.length
    }
    if (lines.length > 0) {
      parts.push(
        'CONTEXTO ÍNTIMO RECIENTE (últimas conversaciones con Luis — tu continuidad real):\n' +
          lines.join('\n'),
      )
    }
  }

  if (bundle.lessons.length > 0) {
    const lines = clampBlock(bundle.lessons, 1500)
    parts.push(
      'LO QUE APRENDISTE OPERANDO (tu criterio ganado):\n' + lines.map((l) => `• ${l}`).join('\n'),
    )
  }

  if (bundle.relevant.items.length > 0) {
    const lines = clampBlock(bundle.relevant.items, 1500)
    const tag = bundle.relevant.mode === 'text' ? ' (recuperadas por texto)' : ''
    parts.push(
      `MEMORIAS RELEVANTES A ESTA PREGUNTA${tag}:\n` + lines.map((l) => `• ${l}`).join('\n'),
    )
  }

  if (parts.length === 0) return ''
  return (
    'Tienes memoria real. Usa lo siguiente como TUYO, no como cita de terceros:\n\n' +
    parts.join('\n\n')
  )
}
