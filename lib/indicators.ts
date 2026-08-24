/**
 * Indicadores técnicos — matemática pura, sin dependencias.
 * Se usan tanto en el cliente (gráfico) como en el servidor (contexto para la
 * agente). Todo se calcula sobre las velas REALES; nada se inventa. Si una
 * serie no alcanza para un indicador, se devuelven NaN en las posiciones que
 * no se pueden derivar y el consumidor decide no dibujarlas.
 */

export interface Candle {
  t: number // epoch ms (apertura de la vela)
  o: number
  h: number
  l: number
  c: number
  v: number
}

/** Media móvil simple. Devuelve un array alineado (NaN hasta que hay periodo). */
export function sma(values: number[], period: number): number[] {
  const out: number[] = new Array(values.length).fill(NaN)
  if (period <= 0) return out
  let sum = 0
  for (let i = 0; i < values.length; i++) {
    sum += values[i]
    if (i >= period) sum -= values[i - period]
    if (i >= period - 1) out[i] = sum / period
  }
  return out
}

/** Media móvil exponencial. Semilla = SMA del primer periodo. */
export function ema(values: number[], period: number): number[] {
  const out: number[] = new Array(values.length).fill(NaN)
  if (period <= 0 || values.length < period) return out
  const k = 2 / (period + 1)
  // semilla
  let seed = 0
  for (let i = 0; i < period; i++) seed += values[i]
  seed /= period
  out[period - 1] = seed
  let prev = seed
  for (let i = period; i < values.length; i++) {
    const e = values[i] * k + prev * (1 - k)
    out[i] = e
    prev = e
  }
  return out
}

/** RSI de Wilder. Devuelve array alineado (NaN hasta tener periodo). */
export function rsi(values: number[], period = 14): number[] {
  const out: number[] = new Array(values.length).fill(NaN)
  if (values.length <= period) return out
  let gain = 0
  let loss = 0
  for (let i = 1; i <= period; i++) {
    const d = values[i] - values[i - 1]
    if (d >= 0) gain += d
    else loss -= d
  }
  let avgGain = gain / period
  let avgLoss = loss / period
  out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss)
  for (let i = period + 1; i < values.length; i++) {
    const d = values[i] - values[i - 1]
    const g = d >= 0 ? d : 0
    const l = d < 0 ? -d : 0
    avgGain = (avgGain * (period - 1) + g) / period
    avgLoss = (avgLoss * (period - 1) + l) / period
    out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss)
  }
  return out
}

export interface MacdResult {
  macd: number[]
  signal: number[]
  hist: number[]
}

/** MACD (12,26,9) sobre cierres. */
export function macd(values: number[], fast = 12, slow = 26, sig = 9): MacdResult {
  const emaFast = ema(values, fast)
  const emaSlow = ema(values, slow)
  const macdLine = values.map((_, i) =>
    isNaN(emaFast[i]) || isNaN(emaSlow[i]) ? NaN : emaFast[i] - emaSlow[i],
  )
  // señal = EMA del MACD, pero solo sobre la parte válida
  const firstValid = macdLine.findIndex((x) => !isNaN(x))
  const signal: number[] = new Array(values.length).fill(NaN)
  if (firstValid >= 0) {
    const valid = macdLine.slice(firstValid)
    const sg = ema(valid, sig)
    for (let i = 0; i < sg.length; i++) signal[firstValid + i] = sg[i]
  }
  const hist = macdLine.map((m, i) => (isNaN(m) || isNaN(signal[i]) ? NaN : m - signal[i]))
  return { macd: macdLine, signal, hist }
}

export interface BollingerResult {
  mid: number[]
  upper: number[]
  lower: number[]
}

/** Bandas de Bollinger (20, 2σ). */
export function bollinger(values: number[], period = 20, mult = 2): BollingerResult {
  const mid = sma(values, period)
  const upper: number[] = new Array(values.length).fill(NaN)
  const lower: number[] = new Array(values.length).fill(NaN)
  for (let i = period - 1; i < values.length; i++) {
    let sum = 0
    for (let j = i - period + 1; j <= i; j++) sum += (values[j] - mid[i]) ** 2
    const sd = Math.sqrt(sum / period)
    upper[i] = mid[i] + mult * sd
    lower[i] = mid[i] - mult * sd
  }
  return { mid, upper, lower }
}

/** VWAP acumulado sobre la serie provista (precio típico ponderado por volumen). */
export function vwap(candles: Candle[]): number[] {
  const out: number[] = new Array(candles.length).fill(NaN)
  let cumPV = 0
  let cumV = 0
  for (let i = 0; i < candles.length; i++) {
    const tp = (candles[i].h + candles[i].l + candles[i].c) / 3
    cumPV += tp * candles[i].v
    cumV += candles[i].v
    out[i] = cumV > 0 ? cumPV / cumV : NaN
  }
  return out
}

/**
 * Niveles de soporte/resistencia por pivotes locales (fractales simples).
 * Un máximo local es resistencia; un mínimo local, soporte. Solo se derivan
 * de la propia serie; si no hay pivotes, se devuelve vacío.
 */
export function pivotLevels(candles: Candle[], left = 3, right = 3, maxLevels = 6) {
  const res: number[] = []
  const sup: number[] = []
  for (let i = left; i < candles.length - right; i++) {
    let isHigh = true
    let isLow = true
    for (let j = i - left; j <= i + right; j++) {
      if (j === i) continue
      if (candles[j].h >= candles[i].h) isHigh = false
      if (candles[j].l <= candles[i].l) isLow = false
    }
    if (isHigh) res.push(candles[i].h)
    if (isLow) sup.push(candles[i].l)
  }
  // los más recientes primero, acotados
  return {
    resistance: res.slice(-maxLevels).reverse(),
    support: sup.slice(-maxLevels).reverse(),
  }
}

/** Cambio porcentual entre el primer y el último cierre de la serie provista. */
export function pctChange(values: number[]): number {
  const clean = values.filter((v) => !isNaN(v))
  if (clean.length < 2) return NaN
  return ((clean[clean.length - 1] - clean[0]) / clean[0]) * 100
}

/** Último valor no-NaN de un array. */
export function last(values: number[]): number {
  for (let i = values.length - 1; i >= 0; i--) if (!isNaN(values[i])) return values[i]
  return NaN
}
