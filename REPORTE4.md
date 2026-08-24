# REPORTE 4 — V-TRADING: EL CHAT ES EL PRODUCTO

Rama: `visual/v-trading-2` · **NO mergeado a main** (el merge lo hace Vulcano tras revisar).
Fecha: 24-ago-2026 · `tsc --noEmit` ✅ · `pnpm build` ✅
Prueba: **de la UI, con Playwright (webkit)**, contra el build de producción local (`next start`)
con los mismos secretos del proyecto Vercel `tanit.work` (mesh/gemini/APP_PASSWORD reales).

---

## LOS 4 ARREGLOS

### 1. El chat de `/chat` estaba roto — REPARADO
**Causa raíz confirmada leyendo el código:** había DOS caminos para hablar con la agente.
- `hooks/use-tanit-chat.ts` → `POST /api/agente` (el bueno, con failover mesh→gemini→error honesto)
  estaba **huérfano: nadie lo usaba**.
- `components/chat-panel.tsx` tenía su **propio** `sendMessage` que pegaba a
  `${API_URL}/bot/mastra-chat-stream` → **el motor muerto (502)**. Ese es el que corría en `/chat`.

**Fix — un solo camino:** `ChatPanel` ahora **consume `useTanitChat`**. Se borró su `sendMessage`
propio y su fetch al motor. El hook es el único dueño de los mensajes y el único que habla con la
agente. Un solo camino = no se vuelve a pudrir sin que nadie lo note.
- El historial de thread también pasa por el hook (`loadThreadMessages`).
- Las imágenes conservan su preview en la burbuja (se extendió el hook, no se regresó UX).
- `/api/proxy` **NO se borró**: sigue ahí para cuando el motor reviva.

**Prueba UI (1440 y 390):** se escribió *"En una sola línea: ¿nivel clave de BTC hoy?"* y
**llegó respuesta en pantalla** en ambos viewports. La agente contestó con datos reales de mercado
(p.ej. *"BTC ≈ $77,913.95, EMA20 $77,314.87, EMA50 $76,940.89, RSI 59… resistencia $78,055.25"*),
lo que prueba que además el contexto Coinbase entra al prompt.

```
VEREDICTO (Playwright)
  1440: respondió=True · fue_a_/api/agente=True · fue_a_motor_muerto=False
  390 : respondió=True · fue_a_/api/agente=True · fue_a_motor_muerto=False
  POSTs tras enviar: [('POST', '/api/agente')]
```
Evidencia: `evidencia/fase4/qa4-1440-despues.png`, `evidencia/fase4/qa4-390-despues.png`.

### 2. Ocho llamadas al motor muerto, en bucle — SILENCIADAS
**Fix — circuit breaker + dedupe en `lib/api.ts` (`getJson`):**
- **Breaker:** a la primera falla (4xx/5xx o error de red) el motor se marca caído y se cortan los
  intentos por **5 min (backoff largo)**. Los intervalos siguen tickeando pero cada llamada se
  rechaza al instante **sin tocar la red**. Se resetea solo al primer éxito.
- **Dedupe de GET concurrentes:** al montar `/chat` varios componentes pedían el MISMO endpoint a la
  vez (tres cards pedían `/portfolio/positions`). Ahora comparten la promesa en vuelo.

**Prueba UI (observando 18s sin tocar nada):**
```
proxy requests al motor: total=8  ráfaga(≤3s)=8  después(>3s)=0
   t+0.5s 404 /api/proxy/system/status
   t+0.5s 404 /api/proxy/tanit/balance-snapshots
   t+0.5s 404 /api/proxy/tanit/decisions
   t+0.5s 404 /api/proxy/tanit/state
   t+0.5s 502 /api/proxy/admin/capital-events
   t+0.5s 502 /api/proxy/bot/threads
   t+0.5s 502 /api/proxy/portfolio/balance
   t+0.5s 502 /api/proxy/portfolio/positions
VEREDICTO no-bucle: OK — sin reintentos tras la ráfaga
```
Las 8 llamadas ocurren **una sola vez** (la detección) y luego **silencio**. Antes reintentaban
en bucle cada 5s para siempre.

**Paneles que dependían del motor → estado offline honesto (sin números inventados):**
- Barra inferior: ya **no** dice *"V-TRADING offline"* ni pinta `$0.00` falso; muestra
  *"CUENTA · motor apagado · sin balances"*.
- Card "Mi cuenta" de la Live sidebar: con el motor caído muestra *"— · offline · motor apagado ·
  sin datos de cuenta"* en vez de `$0.00 MAINNET`.

### 3. El ticker se contradecía — CORREGIDO
`components/market-ticker.tsx`: si hay precio real ahora se etiqueta **su fuente**
(*"referencia · COINBASE"*) y un par sin dato muestra *"—"* neutro. La palabra **"offline" se
reserva** para el feed entero caído, nunca pegada a un precio real.

**Prueba UI:** el ticker superior de `/sistema` muestra `BTC/USD 77,914.0 +0.81%` con el chip
`● REFERENCIA · COINBASE`. El `/api/mercado/tickers` real devuelve `ok:true source:COINBASE` con
BTC/ETH/SOL. Lo que aún dice "offline" es el **motor/cuenta** (que sí lo está), no el mercado.

### 4. La pantalla Sistema mentía — REESCRITA CON LA VERDAD
`app/sistema/page.tsx`:
- **Agente/conversación:** *"malla neuronal (mesh · Cerebras) con respaldo Gemini, vía /api/agente…"*
  y muestra **por cuál vía respondió la última vez** (`via` del evento `done`, persistido por el
  hook en `localStorage`). Estado: **activo** (es independiente del motor).
- **Datos de mercado:** *"Coinbase con respaldo OKX, vía /api/mercado"*, probado contra la fuente
  real (no contra el motor). Estado: **en vivo · COINBASE**.
- **Motor / DB:** offline honesto.

**Prueba UI (texto de la página):** ya **no** contiene `"Grok"`, `"Hetzner → Grok"`, `"Bybit"` ni
`"a través del motor"`; **sí** contiene `"mesh"`, `"Cerebras"`, `"Gemini"`, `"Coinbase"`.
Evidencia: `evidencia/fase4/qa4-sistema-1440.png`.

---

## CRAFT / ILUMINACIÓN (sobre lo que se tocó — el chat)
- **Orbe de la agente** reacciona al estado real (`useTanitChat` → `orbState`): reposo / pensando /
  respondiendo (latido por token) / error a rojo. Se filtra la burbuja fantasma que el hook creaba
  al empezar a pensar (la cubre el ThinkingBubble).
- **Compose** se ilumina al enfocar: anillo rosa con glow suave (`focus-within`), no borde plano.
- **Burbujas de la agente en crystal** nítido (`blur(10px) saturate(1.15)`, borde especular, reflejo
  de canto 1px) — clase `.chat-crystal`, no glassmorphism lechoso.
- **Burbuja del usuario** entra desde la derecha con leve overshoot (`.chat-bubble-anim-user`).
- Todo respeta `prefers-reduced-motion`. No se rompió el anti-banding (gradientes multi-parada +
  grano) previo.

---

## PROHIBIDO — respetado
No se arrancó el motor / PM2 / 8080, no se mandaron órdenes, no se mostraron balances reales, no se
tocaron claves de Bybit, ni auth/middleware, ni los nombres internos con "tanit".

## Qué sigue bloqueado por el motor (apagado por diseño)
Historial de threads, balances/posiciones de la cuenta real, snapshots de equity, decisiones y
`system/status`. Todo eso muestra hoy su **estado offline honesto**. Cuando el motor reviva, `getJson`
detecta el primer éxito, **resetea el breaker solo** y esos paneles vuelven a poblarse sin cambios.

## Archivos tocados
`lib/api.ts` · `hooks/use-tanit-chat.ts` · `hooks/use-live-status.ts` · `components/chat-panel.tsx`
· `components/command-center.tsx` · `components/market-ticker.tsx` · `components/status-bar.tsx`
· `components/live-status-bar.tsx` · `components/live-sidebar.tsx` · `app/sistema/page.tsx`
· `app/globals.css`
