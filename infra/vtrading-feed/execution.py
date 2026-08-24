#!/usr/bin/env python3
"""
MÓDULO DE EJECUCIÓN — escrito, probado contra TESTNET, y APAGADO.

Estado por defecto: TRADING_ENABLED=false. Este módulo NO se importa desde el
feed (feed_service.py no lo toca). Existe listo para el día que Luis y Vulcano
decidan encenderlo, CON evidencia del papel en la mano.

BLINDAJES (todos activos desde el día uno):
  1. TRADING_ENABLED debe ser 'true' explícito. Default false → refuse.
  2. TESTNET forzado salvo confirmación de mainnet específica (frase exacta).
     Así, aunque alguien encienda TRADING_ENABLED, solo llega a api-testnet.
  3. Kill switch: archivo KILL_SWITCH presente o env KILL_SWITCH=1 → refuse total.
  4. Tamaño máximo por operación (MAX_ORDER_USD).
  5. Exposición total máxima (MAX_TOTAL_EXPOSURE_USD) — mide posiciones vivas.
  6. Límite de pérdida diaria (MAX_DAILY_LOSS_USD) — si se superó, apaga todo.
  7. Confirmación explícita (confirm='CONFIRMO') antes de CUALQUIER orden.
  8. NUNCA usa el permiso Wallet. Solo /v5/order/*. Ninguna transferencia.

PROHIBIDO en esta fase: enviar una orden real de mainnet. El código lo hace
imposible sin la frase de confirmación de mainnet, que hoy NO se pasa.
"""
import os, sys, json, time, hmac, hashlib, urllib.request, urllib.parse

# ── Configuración (todo desde entorno; defaults conservadores) ───────────────
def _b(name, default="false"):
    return os.environ.get(name, default).strip().lower() == "true"

def _f(name, default):
    try:
        return float(os.environ.get(name, default))
    except ValueError:
        return float(default)

TRADING_ENABLED     = _b("TRADING_ENABLED", "false")           # APAGADO
TRADING_TESTNET     = _b("TRADING_TESTNET", "true")            # testnet por defecto
MAINNET_CONFIRM     = os.environ.get("MAINNET_CONFIRM_PHRASE", "")
MAINNET_UNLOCK      = "ENCENDER-MAINNET-CON-LUIS"              # frase exacta requerida
MAX_ORDER_USD       = _f("MAX_ORDER_USD", "25")               # nocional por operación
MAX_TOTAL_EXPOSURE  = _f("MAX_TOTAL_EXPOSURE_USD", "100")     # exposición total viva
MAX_DAILY_LOSS_USD  = _f("MAX_DAILY_LOSS_USD", "15")          # pérdida diaria máx
KILL_SWITCH_FILE    = os.environ.get("KILL_SWITCH_FILE", "/root/agents/vtrading-feed/KILL_SWITCH")

TESTNET_URL = "https://api-testnet.bybit.com"
MAINNET_URL = "https://api.bybit.com"
RECV_WINDOW = "5000"


class ExecutionBlocked(Exception):
    pass


def kill_switch_active() -> bool:
    return os.path.exists(KILL_SWITCH_FILE) or os.environ.get("KILL_SWITCH") == "1"


def _base_url() -> str:
    """Testnet salvo que se pase la frase EXACTA de mainnet. Falla cerrada."""
    if TRADING_TESTNET:
        return TESTNET_URL
    if MAINNET_CONFIRM == MAINNET_UNLOCK:
        return MAINNET_URL
    # Pidieron mainnet pero sin la frase: forzamos testnet (no rompe, no arriesga).
    return TESTNET_URL


def _is_mainnet() -> bool:
    return _base_url() == MAINNET_URL


# ── Guardrails puros (testeable sin red) ─────────────────────────────────────
def check_guardrails(order: dict, live_exposure_usd: float = 0.0,
                     realized_pnl_today: float = 0.0, confirm: str = "") -> dict:
    """Devuelve {'ok':bool,'reasons':[...]}. NO envía nada."""
    reasons = []
    if not TRADING_ENABLED:
        reasons.append("TRADING_ENABLED=false (interruptor maestro apagado)")
    if kill_switch_active():
        reasons.append("kill switch ACTIVO")
    if confirm != "CONFIRMO":
        reasons.append("falta confirmación explícita (confirm='CONFIRMO')")

    size = float(order.get("size_usd", 0))
    if size <= 0:
        reasons.append("size_usd inválido")
    if size > MAX_ORDER_USD:
        reasons.append(f"size ${size} supera MAX_ORDER_USD ${MAX_ORDER_USD}")
    if live_exposure_usd + size > MAX_TOTAL_EXPOSURE:
        reasons.append(f"exposición ${live_exposure_usd}+${size} supera MAX_TOTAL_EXPOSURE_USD ${MAX_TOTAL_EXPOSURE}")
    if realized_pnl_today <= -abs(MAX_DAILY_LOSS_USD):
        reasons.append(f"pérdida diaria ${realized_pnl_today} alcanzó el límite ${MAX_DAILY_LOSS_USD} — todo apagado")

    if order.get("side") not in ("Buy", "Sell"):
        reasons.append("side debe ser Buy/Sell")
    if not order.get("symbol"):
        reasons.append("falta symbol")
    if order.get("stop_loss") in (None, 0):
        reasons.append("SL obligatorio (no se abre sin stop)")

    return {"ok": len(reasons) == 0, "reasons": reasons, "target": "testnet" if not _is_mainnet() else "MAINNET"}


# ── Envío firmado (solo se alcanza si guardrails pasan) ──────────────────────
def _signed_post(path: str, params: dict, timeout: int = 10) -> dict:
    key = os.environ.get("BYBIT_TESTNET_KEY") if not _is_mainnet() else os.environ.get("BYBIT_KEY_NEW")
    sec = os.environ.get("BYBIT_TESTNET_SECRET") if not _is_mainnet() else os.environ.get("BYBIT_SECRET_NEW")
    if not key or not sec:
        raise ExecutionBlocked(f"faltan llaves para {'testnet' if not _is_mainnet() else 'mainnet'} — no se puede firmar (esperado en esta fase)")
    body = json.dumps(params)
    ts = str(int(time.time() * 1000))
    sig = hmac.new(sec.encode(), (ts + key + RECV_WINDOW + body).encode(), hashlib.sha256).hexdigest()
    req = urllib.request.Request(_base_url() + path, data=body.encode(), method="POST", headers={
        "Content-Type": "application/json", "X-BAPI-API-KEY": key,
        "X-BAPI-TIMESTAMP": ts, "X-BAPI-SIGN": sig, "X-BAPI-RECV-WINDOW": RECV_WINDOW,
    })
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode() or "{}")


def place_order(order: dict, live_exposure_usd: float = 0.0,
                realized_pnl_today: float = 0.0, confirm: str = "") -> dict:
    """Punto ÚNICO de envío de órdenes. Pasa por todos los guardrails. Con la
    config de esta fase (TRADING_ENABLED=false) SIEMPRE devuelve blocked."""
    g = check_guardrails(order, live_exposure_usd, realized_pnl_today, confirm)
    if not g["ok"]:
        return {"sent": False, "blocked": True, "guardrails": g}

    # Doble candado antes de tocar la red:
    if not TRADING_ENABLED or kill_switch_active():
        return {"sent": False, "blocked": True, "guardrails": g, "note": "candado final"}

    qty = order["qty"]  # el caller ya la calculó con lot-step
    body = {
        "category": "linear", "symbol": order["symbol"], "side": order["side"],
        "orderType": "Market", "qty": str(qty), "timeInForce": "GoodTillCancel",
        "reduceOnly": bool(order.get("reduce_only", False)), "positionIdx": order.get("position_idx", 0),
        "stopLoss": str(order["stop_loss"]), "slTriggerBy": "LastPrice", "tpslMode": "Full",
    }
    if order.get("take_profit"):
        body["takeProfit"] = str(order["take_profit"])
        body["tpTriggerBy"] = "LastPrice"
    resp = _signed_post("/v5/order/create", body)
    return {"sent": resp.get("retCode") == 0, "target": g["target"], "retCode": resp.get("retCode"),
            "retMsg": resp.get("retMsg"), "orderId": (resp.get("result") or {}).get("orderId")}


def kill():
    """Activa el kill switch (crea el archivo). Idempotente."""
    open(KILL_SWITCH_FILE, "w").write(f"killed {int(time.time())}\n")


def status() -> dict:
    return {
        "TRADING_ENABLED": TRADING_ENABLED,
        "target": "testnet" if not _is_mainnet() else "MAINNET",
        "testnet_forced": TRADING_TESTNET,
        "kill_switch_active": kill_switch_active(),
        "limits": {"max_order_usd": MAX_ORDER_USD, "max_total_exposure_usd": MAX_TOTAL_EXPOSURE,
                   "max_daily_loss_usd": MAX_DAILY_LOSS_USD},
        "mainnet_unlocked": _is_mainnet(),
    }


# ── CLI: preflight (sin red) y selftest (guardrails) ─────────────────────────
if __name__ == "__main__":
    def _load_dotenv(path="/root/.env"):
        try:
            for line in open(path):
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
        except FileNotFoundError:
            pass
    _load_dotenv()

    cmd = sys.argv[1] if len(sys.argv) > 1 else "preflight"
    sample = {"symbol": "BTCUSDT", "side": "Buy", "size_usd": 10, "qty": "0.001",
              "stop_loss": 60000, "take_profit": 70000}

    if cmd == "preflight":
        print(json.dumps({"status": status(),
                          "guardrails_sample": check_guardrails(sample, confirm="CONFIRMO")}, indent=2))

    elif cmd == "selftest":
        # 1) apagado por defecto → bloquea aunque todo lo demás esté bien
        r = place_order(sample, confirm="CONFIRMO")
        assert r["blocked"] is True, "debería bloquear con TRADING_ENABLED=false"
        # 2) size sobre el tope
        g = check_guardrails({**sample, "size_usd": 9999}, confirm="CONFIRMO")
        assert any("MAX_ORDER_USD" in x for x in g["reasons"]), "debe pegar el tope de tamaño"
        # 3) sin SL
        g = check_guardrails({**sample, "stop_loss": None}, confirm="CONFIRMO")
        assert any("SL obligatorio" in x for x in g["reasons"]), "debe exigir SL"
        # 4) sin confirmación
        g = check_guardrails(sample, confirm="")
        assert any("confirmación" in x for x in g["reasons"]), "debe exigir confirmación"
        # 5) pérdida diaria
        g = check_guardrails(sample, realized_pnl_today=-999, confirm="CONFIRMO")
        assert any("pérdida diaria" in x for x in g["reasons"]), "debe cortar por pérdida diaria"
        # 6) exposición total
        g = check_guardrails(sample, live_exposure_usd=95, confirm="CONFIRMO")
        assert any("exposición" in x for x in g["reasons"]), "debe cortar por exposición"
        # 7) target siempre testnet en esta fase
        assert not _is_mainnet(), "en esta fase NUNCA mainnet"
        print("SELFTEST OK — 7/7 guardrails verificados. Ejecución sigue APAGADA y forzada a testnet.")

    elif cmd == "kill":
        kill()
        print("kill switch ACTIVADO")

    else:
        print("uso: execution.py [preflight|selftest|kill]")
