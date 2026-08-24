import { NextResponse } from 'next/server'
import { getMarketSnapshots } from '@/lib/market'

/**
 * GET /api/mercado/tickers
 *   → { ok, source, tickers:[{symbol, price, change24hPct, high24h, low24h,
 *       volume24h, rsi14, ema20, ema50, ema200, trend}] }
 *
 * Precios de REFERENCIA (Coinbase → OKX). Alimenta el ticker superior y las
 * tarjetas de /mercado. Nada de la cuenta ni del motor.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const snaps = await getMarketSnapshots()
  if (!snaps.length) {
    return NextResponse.json(
      { ok: false, source: null, tickers: [], error: 'Fuentes de referencia sin respuesta.' },
      { status: 503 },
    )
  }
  return NextResponse.json(
    { ok: true, source: snaps[0].source, tickers: snaps },
    { headers: { 'cache-control': 'public, max-age=15, s-maxage=30' } },
  )
}
