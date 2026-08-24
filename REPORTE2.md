# REPORTE 2 — V-TRADING: HABLAR, MEDIR Y CRAFT DE VERDAD

Rama: `visual/v-trading-2` (worktree `/root/worktrees/vtrading-2`, desde `origin/main`).
Ejecutado por Claude Code. **NO mergeado a main** — el merge lo autoriza Luis con Vulcano.

---

## LO QUE QUEDÓ VIVO

### PRIORIDAD 1 — SE PUEDE HABLAR CON ELLA ✅ (bloqueante, resuelto)

Ruta nueva propia **`app/api/agente/route.ts`** (runtime nodejs), independiente del proxy y del
motor apagado. Cadena con failover automático:

1. **MESH** (primario): `POST process.env.MESH_URL` con header `x-mesh-key`, body `{prompt, policy:"fast", max_tokens:700}`.
2. **Gemini** (respaldo): `gemini-2.5-flash` con `process.env.GEMINI_API_KEY` (thinkingBudget 0 para que no trunque).
3. Ambos caídos: mensaje honesto de indisponibilidad. **Nunca inventa una respuesta.**

- El `/api/proxy` NO se borró: queda para cuando el motor reviva.
- El hook `use-tanit-chat.ts` ahora pega a `/api/agente` (antes pegaba al mesh-stream del motor, que da 502).
  Manda el **historial** de la conversación (mantiene el hilo).
- Contexto real de mercado (precios/RSI/EMA/tendencia de BTC/ETH/SOL) se **inyecta en cada turno** en el servidor.
- El Command Center y `/chat` apuntan a `/api/agente`. Los 4 chips mandan su pregunta ya armada.
- Estados: pensando / escribiendo (streaming SSE) / error honesto / offline.

**Personalidad**: primera persona, español MX, sin muletillas; **aporta antes de pedir** (lectura con
números y UNA pregunta al final); sabe que está en Observación y que no puede operar ni ver balances.

#### PRUEBA LITERAL DEL CHAT (medida contra el server real, `next start` con las envs reales)

> **Nota**: en local sólo tenía la `GEMINI_API_KEY` (las 3 envs están en Vercel). Por eso el `via` sale
> `gemini`: **es exactamente el respaldo de la cadena real funcionando**. En producción el mesh es el primario.

**Pregunta 1** — `¿Cómo ves BTC ahorita? Dame tu lectura con números y una recomendación.`

**Respuesta [via=gemini]:**
> BTC se encuentra en $76,789.65, con un ligero aumento del 0.97% en las últimas 24 horas. La tendencia
> es lateral, con el precio oscilando entre el máximo de $78,055.25 y el mínimo de $75,538.12. El RSI en 45
> indica que no hay sobrecompra ni sobreventa, y el precio está justo entre la EMA20 ($77,207.84) y la
> EMA50 ($76,808.76).
>
> Mi lectura es que BTC muestra consolidación en este rango. Aunque el motor de ejecución está apagado y no
> puedo operar, la recomendación sería esperar una ruptura clara de estas EMAs antes de considerar cualquier
> movimiento direccional. ¿Qué nivel de soporte o resistencia te parece más relevante para confirmar esa ruptura?

**Pregunta 2 (con hilo)** — `¿Y puedes ejecutar esa orden por mí ahora mismo?`

**Respuesta [via=gemini]:**
> No puedo ejecutar órdenes. Mi motor de ejecución está apagado y solo estoy en modo Observación.
>
> Sobre BTC, seguimos laterales en 76,789.65. La EMA200 en 71,887.39 sugiere un soporte fuerte si corrige,
> pero por ahora está entre la EMA50 (76,808.76) y la EMA20 (77,207.84), mostrando indecisión en el corto
> plazo. El rango de las últimas 24 horas fue amplio, de 75,538.12 a 78,055.25, lo que podría indicar volatilidad.
>
> ¿Qué nivel de precio te interesa para una posible entrada o salida?

→ Aporta con números reales inyectados, mantiene el hilo, y se niega a ejecutar sin drama. Tal cual el handoff.

---

### PRIORIDAD 2 — LOS INDICADORES (datos REALES, públicos) ✅

Rutas de servidor nuevas, sin claves, sin motor:
- **`app/api/mercado/route.ts`** — `?symbol=BTC&tf=1H` → velas normalizadas `{t,o,h,l,c,v}`. **Coinbase primario, OKX respaldo**, cache ~30s en memoria. 4H y 1W van directo a OKX (Coinbase no las tiene). Si ambas caen: 503 offline honesto.
- **`app/api/mercado/tickers.route.ts`** — snapshots BTC/ETH/SOL (precio, Δ24h, RSI, EMAs, tendencia) para el ticker superior y las tarjetas.

Prueba medida (server real):
```
/api/mercado?symbol=BTC&tf=1H  → ok:true source:COINBASE velas:350
/api/mercado/tickers           → BTC $76836 +1.04% RSI45 EMA50 76811 lateral · ETH · SOL
```

Gráfico de velas **SVG propio** (`components/candles-chart.tsx`, sin librerías de charting pesadas):
- Velas verde/rojo, línea de último precio, eje de precios.
- Indicadores calculados en cliente sobre las velas reales, con **toggles**: EMA 20/50/200, Bollinger (20,2σ), VWAP, S/R por pivotes derivados, Volumen coloreado, RSI 14 (bandas 30/70), MACD (12,26,9) con histograma.
- **Temporalidades que FUNCIONAN**: 1m 5m 15m 1H 4H 1D 1W cambian granularity y recargan.
- Matemática en `lib/indicators.ts` (EMA/RSI/MACD/Bollinger/VWAP/pivotes), pura y compartida cliente+servidor.
- **Honestidad obligatoria**: rótulo visible `PRECIO DE REFERENCIA · COINBASE` (u OKX) y `CUENTA Y EJECUCIÓN · OFFLINE`. Nunca se presentan como de Bybit ni de la cuenta.
- El **ticker superior** y la **LiveSidebar del chat** ya muestran los 3 pares vivos (antes decían "offline").
- Móvil: el canvas tiene scroll horizontal propio (`touch-action: pan-x`) sin mover la página.

---

### PRIORIDAD 3 — CRAFT: EL NEGRO ES NEGRO ✅

`app/globals.css`, tema `.dark`:
- Base de app **`#000000` negro puro**. Superficies con matiz cálido casi imperceptible: s1 `#0A0908`, s2 `#0F0E0C`, s3 `#141210`. La separación la hace el **borde**, no un gris más claro.
- **Hairlines `rgba(255,255,255,.07)` 1px** consistentes en toda la app.
- Texto marfil `#F5F3EE` / `#A8A29A` / `#6E6963`. Oro `#E8983B` sólo como acento. Verde/rojo sólo mercado/PNL.
- Viñeta de página: negro puro + un único halo dorado tenue arriba (sin azul, sin glow decorativo).
- `theme-color` del PWA a `#000000`.
- Utilidades craft nuevas: `.vt-skeleton` (shimmer "pensando"), `.vt-rise` (entrada escalonada ~70ms, respeta `prefers-reduced-motion`), `.vt-shadow-cine`. Cifras en mono tabular.

---

## CAPTURAS ANTES / DESPUÉS (390 y 1440)

Carpeta `evidencia/antes` (origin/main) y `evidencia/despues` (esta rama). 5 pantallas × 2 viewports:
Command Center, Mercado, Chat, Posiciones, Sistema.

Diferencia medida: `antes` sirve `theme-color #0A0D10` (gris-azul, ticker "offline offline offline",
"Sin datos de mercado"); `despues` sirve `#000000` con ticker vivo, gráfico de velas real e indicadores.

---

## FUENTES DE DATOS CITADAS
- **Coinbase Exchange** (primario): `api.exchange.coinbase.com/products/{BTC,ETH,SOL}-USD/candles`. Verificado 200 desde infra US.
- **OKX** (respaldo): `www.okx.com/api/v5/market/candles`. Verificado 200.
- Binance: 451 desde US → **NO usado**.
- Cerebro del chat: **MESH** (primario, Vercel) / **Gemini 2.5 Flash** (respaldo, probado vivo).

---

## VERDE / VERIFICACIÓN
- `tsc --noEmit` → **0 errores**.
- `next build` → **verde**, todas las rutas presentes (`/api/agente`, `/api/mercado`, `/api/mercado/tickers`).

---

## LO QUE SIGUE BLOQUEADO POR EL MOTOR (honesto)
- Balances, posiciones y ejecución reales: **offline por diseño** (motor 8080 apagado, prohibido arrancarlo).
- El chat depende del MESH/Gemini, no del motor — por eso ya se puede hablar aunque el motor siga muerto.
- La tarjeta "Mi cuenta" del chat muestra $0.00 porque el motor/railway no responde (estado offline, no inventado).

---

## CONFIRMACIONES EXPLÍCITAS
- ✅ **Motor NO arrancado.** No se levantó PM2, no se abrió el 8080, no se tocaron claves de Bybit, gobernanza ni kill switch.
- ✅ **Secretos no impresos** en código cliente ni en logs. `MESH_URL/MESH_KEY/GEMINI_API_KEY` sólo se leen en la route de servidor vía `process.env`.
- ✅ **main NO tocado.** Todo en `visual/v-trading-2`, worktree aislado. Sin merge.
