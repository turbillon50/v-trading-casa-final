import { NextRequest, NextResponse } from 'next/server'
import { feedConfigured, perpTicker, toPerpSymbol } from '@/lib/hetzner-feed'

/**
 * GET /api/mercado/perp?symbol=BTC
 *   → ticker de PERPETUO Bybit (vía Hetzner): markPrice, indexPrice, fundingRate
 *     (+ anualizado), openInterest, basis. Lo que sí mueve la aguja en perps.
 *
 * Si el feed del Hetzner no está configurado o no responde: { ok:false } y la UI
 * simplemente no muestra el bloque de perp (cae a la referencia spot).
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const symbol = (req.nextUrl.searchParams.get('symbol') ?? 'BTC').toUpperCase()
  if (!feedConfigured()) {
    return NextResponse.json({ ok: false, error: 'feed-perp-no-configurado' }, { status: 503 })
  }
  try {
    const t = await perpTicker(toPerpSymbol(symbol))
    return NextResponse.json(
      { ok: true, ...t },
      { headers: { 'cache-control': 'public, max-age=10, s-maxage=15' } },
    )
  } catch (err) {
    return NextResponse.json(
      { ok: false, symbol, error: 'Feed de perpetuos (Bybit/Hetzner) sin respuesta.', detail: err instanceof Error ? err.message : String(err) },
      { status: 503 },
    )
  }
}
