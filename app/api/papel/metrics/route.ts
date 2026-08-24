import { NextResponse } from 'next/server'
import { feedConfigured, paperMetrics } from '@/lib/hetzner-feed'

/**
 * GET /api/papel/metrics
 *   → win rate, PnL neto, expectativa por operación y cuánto se llevaron las
 *     comisiones (la cifra que mató al sistema anterior).
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  if (!feedConfigured()) {
    return NextResponse.json({ ok: false, error: 'feed-no-configurado' }, { status: 503 })
  }
  try {
    const { metrics } = await paperMetrics()
    return NextResponse.json({ ok: true, metrics })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: 'Feed de papel sin respuesta.', detail: err instanceof Error ? err.message : String(err) },
      { status: 503 },
    )
  }
}
