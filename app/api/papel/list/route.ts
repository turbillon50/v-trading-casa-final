import { NextRequest, NextResponse } from 'next/server'
import { feedConfigured, paperList } from '@/lib/hetzner-feed'

/**
 * GET /api/papel/list?limit=100
 *   → operaciones en MODO PAPEL (con su tesis) desde el feed del Hetzner.
 * El token del feed vive solo en el servidor; nunca llega al cliente.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const limit = Number(req.nextUrl.searchParams.get('limit') ?? '100')
  if (!feedConfigured()) {
    return NextResponse.json({ ok: false, trades: [], error: 'feed-no-configurado' }, { status: 503 })
  }
  try {
    const { trades } = await paperList(limit)
    return NextResponse.json({ ok: true, trades })
  } catch (err) {
    return NextResponse.json(
      { ok: false, trades: [], error: 'Feed de papel sin respuesta.', detail: err instanceof Error ? err.message : String(err) },
      { status: 503 },
    )
  }
}
