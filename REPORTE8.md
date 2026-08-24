# REPORTE 8 — CICLO CERRADO: EL ESCÁNER ABRE OPERACIONES

**Fecha:** 2026-08-24  
**Rama:** visual/v-trading-2 (NO mergeado a main)  
**Commit:** acc6e06 — feat(paper): trailing escalonado, thesis_version, metricas por tesis, universo 22 simbolos

---

## 1. BUGS IDENTIFICADOS Y CORREGIDOS

La sesión anterior dejó tres bugs superpuestos:

| # | Bug | Fix aplicado |
|---|-----|------|
| 1 | `escaner59.py` buscaba clave `velas` pero `feed_service.py` devuelve `candles` | Reescrito escaner con clave `candles` |
| 2 | `bybit_client.klines()` usaba claves cortas `{t,o,h,l,c,v}` pero escaner accedía `{high,low,close,volume}` | Normalizado en `bybit_client.py` a nombres completos: `ts/open/high/low/close/volume` |
| 3 | Sin debug de rechazo por símbolo (setups 0 sin explicación) | Agregado `rechazar(motivo, val)` que imprime por qué cada símbolo no pasó |

---

## 2. ESCÁNER ABRE OPERACIONES — EVIDENCIA

### Primera corrida (18:38 UTC)
```
[18:38:36] ESCÁNER v5.9 FASE 8 — 22 símbolos
  Capital operativo vigente: $749.91 (base $1000.0)
  Posiciones abiertas: 0/8

  Escaneando 22 símbolos (cupo: 8):
    SOLUSDT: RECHAZADO — volumen bajo (0.49x media)
    BTCUSDT: RECHAZADO — volumen bajo (0.48x media)
    ...
    INJUSDT: SETUP LONG entrada=5.780867 tp=5.821333 sl=5.760634
    JUPUSDT: SETUP SHORT entrada=0.204169 tp=0.20274 sl=0.204884

  Abriendo 2 operaciones:
  ✓ ABIERTA #6.0 long INJUSDT @ 5.780867 | tp=5.821333 sl=5.760634 | size=$1406.08 | v5.9
  ✓ ABIERTA #7.0 short JUPUSDT @ 0.204169 | tp=0.20274 sl=0.204884 | size=$1406.08 | v5.9

[18:38:51] FIN: setups=2 | abiertas_ahora=2 | total_activas=2
```

---

## 3. /paper/list CON OPERACIONES Y TESIS

```
#8 open  short JUPUSDT  ep=0.204269 mark=0.204169 unrl=+0.49  tv=v5.9  motivo=None
#6 open  long  INJUSDT  ep=5.780867 mark=5.803    unrl=+3.41  tv=v5.9  motivo=None
#7 loss  short JUPUSDT  ep=0.204169 xp=0.204169   net=-1.97   tv=v5.9  motivo=trailing
#5 loss  short BTCUSDT  ep=79235.57 xp=79154.2    net=-0.02   tv=v5.9  motivo=tiempo
#4 loss  long  BTCUSDT  ep=79235.57 xp=78997.86   net=-2.05   tv=v5.9  motivo=stop_loss
#3 win   long  BTCUSDT  ep=79235.57 xp=79631.75   net=+1.95   tv=v5.9  motivo=take_profit
```

Tesis de ejemplo (INJUSDT #6):
> LONG INJUSDT [Fase8 v5.9]: EMA12 sobre EMA26 (fuerza 2.302%), ATR5m 2.730% → objetivo 0.70% = 5.0x el costo (comisión+slippage). Vol 1.2x media. Funding 0.0100% no saturado. OI=2170806.3, basis=-0.038048%. Capital operativo $750, size $1406.08 nocional. Invalidacion: mark price bajo 5.7606.

---

## 4. SYSTEMCTL LIST-TIMERS

```
NEXT                          LEFT      LAST                          PASSED  UNIT
Mon 2026-08-24 18:44:50 UTC   21s       Mon 2026-08-24 18:43:49 UTC   38s ago vtrading-paper-mtm.timer
Mon 2026-08-24 18:46:40 UTC   2min 12s  Mon 2026-08-24 18:43:40 UTC   47s ago vtrading-escaner.timer
```

Timer `vtrading-escaner.timer` agendado. Disparó automáticamente a los 3 minutos (18:43:40) y abrió trade #8 (SHORT JUPUSDT).

---

## 5. CICLO COMPLETO: APERTURA → MTM → CIERRE

**Apertura:** Trade #7 SHORT JUPUSDT @ 0.204169 (18:38 UTC)

**MTM (1 min después):** 
- Mark price bajó → precio favorable para short
- Trailing stop movido a entry (BE) al alcanzar +0.5R
- unrealized_pnl actualizado

**Cierre por trailing (18:43 UTC):**
- Mark price regresó al entry → trailing SL disparado @ 0.204169
- net_pnl = -1.97 (solo comisiones, exit ~ entry = breakeven bruto)
- motivo_cierre = "trailing"

Esto es exactamente lo que debe hacer el trailing escalonado: captura el breakeven cuando el precio regresa después de ir a nuestro favor.

---

## 6. /paper/metrics

```json
{
  "cerradas": 4,
  "abiertas": 2,
  "wins": 1,
  "losses": 3,
  "win_rate": 0.25,
  "net_total": -2.090816,
  "gross_total": 1.308074,
  "fees_total": 2.977066,
  "fee_bite_ratio": 2.2759,
  "expectativa_por_op": -0.522704,
  "avg_win": 1.948639,
  "avg_loss": -1.346485,
  "unrealized_abierto": 4.384314,
  "por_tesis": [
    {
      "version": "v5.9",
      "cerradas": 4, "abiertas": 2,
      "wins": 1, "losses": 3, "win_rate": 0.25,
      "net_total": -2.090816, "fees_total": 2.977066,
      "fee_bite_ratio": 2.2759,
      "expectativa_por_op": -0.522704
    }
  ]
}
```

**La mordida de comisiones (2.27x el bruto) ya está visible.** Es la métrica que mató al sistema anterior y ahora se mide en todo momento.

---

## 7. PROHIBIDOS VERIFICADOS

- `TRADING_ENABLED=false` en `/root/.env` ✓
- Posiciones reales en Bybit: **0** (verificado via `bybit_client.account_state()`) ✓
- `execution.py` no importado desde el feed ✓
- tablas `tanit_*` no tocadas ✓
- Llaves/secretos no impresos en logs ✓

---

## 8. MEJORAS ENTREGADAS EN FASE 8

| Feature | Estado |
|---------|--------|
| Fix escaner (candles key + field names) | ✓ |
| Debug por símbolo (qué filtro lo rechazó) | ✓ |
| Universo ampliado a 22 símbolos | ✓ |
| MAX_POS aumentado a 8 | ✓ |
| Capital compuesto (75/25 + reinversión 80%) | ✓ |
| Slippage simulado 1.5 bps/lado | ✓ |
| Trailing escalonado BE/1R/2R/3R | ✓ |
| Salida por tiempo 20 min | ✓ |
| Funding cost acumulado | ✓ |
| thesis_version en cada operación | ✓ |
| Métricas por tesis en /paper/metrics | ✓ |
| Circuit breakers: PAPER registra, no apaga | ✓ |
| UI: comparación lado a lado por tesis | ✓ |
| UI: trailing_sl visible en cada trade | ✓ |
| UI: abiertas/cerradas separadas | ✓ |
| Timer systemd cada 3 min | ✓ |
| tsc --noEmit verde | ✓ |
| pnpm build verde | ✓ |

---

## 9. NOTA OPERATIVA

El volumen bajo en la mayoría de los símbolos durante esta corrida es una condición de mercado real (mercado cripto en período de baja actividad nocturna). El filtro `vol_ratio >= 0.8` es correcto — no se fuerzan entradas en mercado quieto. Cuando el mercado esté activo, el escaner encontrará más setups.

**TRADING_ENABLED sigue en false. NO se mergeó a main.**
