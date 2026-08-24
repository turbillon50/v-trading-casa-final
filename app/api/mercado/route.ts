import { NextRequest, NextResponse } from 'next/server'
import { getCandles, SYMBOLS, TIMEFRAMES, type MarketSymbol, type Timeframe } from '@/lib/market'

/**
 * GET /api/mercado?symbol=BTC&tf=1H
 *   → { ok, symbol, timeframe, source, candles:[{t,o,h,l,c,v}], ts }
 *
 * Precios de REFERENCIA públicos (Coinbase → OKX). Sin claves, sin motor.
 * Si ambas fuentes caen: { ok:false } y la UI muestra offline honesto.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function normSymbol(s: string | null): MarketSymbol {
  const up = (s ?? 'BTC').toUpperCase()
  return (SYMBOLS as string[]).includes(up) ? (up as MarketSymbol) : 'BTC'
}
function normTf(s: string | null): Timeframe {
  const up = s ?? '1H'
  return (TIMEFRAMES as string[]).includes(up) ? (up as Timeframe) : '1H'
}

export async function GET(req: NextRequest) {
  const symbol = normSymbol(req.nextUrl.searchParams.get('symbol'))
  const tf = normTf(req.nextUrl.searchParams.get('tf'))
  try {
    const series = await getCandles(symbol, tf)
    return NextResponse.json(
      { ok: true, ...series },
      { headers: { 'cache-control': 'public, max-age=15, s-maxage=30' } },
    )
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        symbol,
        timeframe: tf,
        error: 'Fuentes de referencia (Coinbase/OKX) sin respuesta.',
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 503 },
    )
  }
}
