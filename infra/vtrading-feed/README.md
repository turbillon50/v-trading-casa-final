# V-TRADING Feed (Hetzner) — Fase 7

Bybit responde **403 desde Vercel (US)** y **200 desde el Hetzner (Alemania)**. Por
eso todo lo que toca Bybit vive aquí, en el servidor, y la app en Vercel lo consume
por un path nginx autenticado. **Estos archivos son copia de `/root/agents/vtrading-feed/`
en el Hetzner** (fuente de verdad en el servidor; aquí se versionan para revisión).

## Componentes
- `bybit_client.py` — firma Bybit V5 (HMAC). Público (market data) + **privado SOLO LECTURA** (wallet-balance, position/list). Ninguna escritura.
- `feed_service.py` — HTTP en `127.0.0.1:8098`. Endpoints perp + `/cuenta/estado` + `/paper/*`. Todo detrás de `X-Feed-Token` salvo `/health`.
- `paper_engine.py` — modo papel: abrir (tesis obligatoria), marca a mercado, cierre TP/SL/tiempo con **comisión real** (taker 0.055%/lado), métricas.
- `execution.py` — módulo de ejecución **APAGADO** (`TRADING_ENABLED=false`), forzado a **testnet**, con topes de tamaño/exposición/pérdida diaria, kill switch y confirmación explícita. `feed_service.py` NO lo importa.
- `schema.sql` — tabla `vt_paper_trades` (NUEVA, aislada; no toca tablas `tanit_*`). CHECK impone tesis a nivel de base.

## Env (en `/root/.env`, chmod 600 — nunca en el repo)
`BYBIT_KEY_NEW`, `BYBIT_SECRET_NEW` (read-only en esta fase), `NEON_DATABASE_URL_TANIT`,
`HETZNER_FEED_TOKEN`. Ejecución (apagada): `TRADING_ENABLED=false`, `TRADING_TESTNET=true`,
`MAX_ORDER_USD`, `MAX_TOTAL_EXPOSURE_USD`, `MAX_DAILY_LOSS_USD`.

## systemd
- `vtrading-feed.service` — el servicio HTTP.
- `vtrading-paper-mtm.service` + `.timer` — marca a mercado del papel cada minuto.

```bash
systemctl enable --now vtrading-feed.service
systemctl enable --now vtrading-paper-mtm.timer
```

## nginx (en `api.vforge.site`)
`location /vtfeed/ → http://127.0.0.1:8098/`. La app usa
`HETZNER_FEED_URL=https://api.vforge.site/vtfeed` + `HETZNER_FEED_TOKEN`.

## Encender ejecución (NO en esta fase — decisión de Luis con evidencia del papel)
1. Crear llaves **testnet** → `BYBIT_TESTNET_KEY/SECRET`, probar `execution.py` contra testnet.
2. Solo después, con papel positivo: `TRADING_ENABLED=true` y la frase de mainnet. Kill switch: `python3 execution.py kill`.
