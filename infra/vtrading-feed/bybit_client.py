#!/usr/bin/env python3
"""
Cliente Bybit V5 para el Hetzner (Alemania → 200; Vercel US → 403).

Reglas de esta fase:
  - PÚBLICO (market data): sin firma.
  - PRIVADO: SOLO LECTURA (wallet-balance, position/list). Firma HMAC V5.
  - Ninguna función de escritura vive aquí. La ejecución (testnet, apagada) vive
    aparte en execution.py y nunca se importa desde el feed.

Firma V5 (idéntica al cliente TS canónico bybit-auth.ts):
    sign = HMAC_SHA256(secret, ts + api_key + recv_window + payload)
    payload GET  = querystring   ·  payload POST = body JSON

NUNCA imprime llaves ni balances. Los errores se devuelven como retCode/retMsg.
"""
import os, time, hmac, hashlib, json, urllib.request, urllib.parse

MAINNET_URL = "https://api.bybit.com"
TESTNET_URL = "https://api-testnet.bybit.com"
RECV_WINDOW = "5000"

# Llaves NUEVAS validadas por Luis (readOnly:0, expira 24-nov). Aquí SOLO se usan
# para lectura. Se leen del entorno; si no están, las privadas fallan honesto.
def _keys():
    return os.environ.get("BYBIT_KEY_NEW", ""), os.environ.get("BYBIT_SECRET_NEW", "")

def _base(testnet: bool) -> str:
    return TESTNET_URL if testnet else MAINNET_URL


class BybitError(Exception):
    pass


def _request(method: str, path: str, params: dict, signed: bool, testnet: bool = False, timeout: int = 10):
    params = params or {}
    qs = urllib.parse.urlencode(params)
    url = f"{_base(testnet)}{path}"
    body = None
    if method == "GET":
        payload = qs
        if qs:
            url += f"?{qs}"
    else:
        body = json.dumps(params).encode()
        payload = body.decode()

    headers = {"Content-Type": "application/json"}
    if signed:
        key, sec = _keys()
        if not key or not sec:
            raise BybitError("llaves Bybit no configuradas (BYBIT_KEY_NEW/SECRET_NEW)")
        ts = str(int(time.time() * 1000))
        sig = hmac.new(sec.encode(), (ts + key + RECV_WINDOW + payload).encode(), hashlib.sha256).hexdigest()
        headers.update({
            "X-BAPI-API-KEY": key,
            "X-BAPI-TIMESTAMP": ts,
            "X-BAPI-SIGN": sig,
            "X-BAPI-RECV-WINDOW": RECV_WINDOW,
        })

    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        raw = r.read().decode()
    data = json.loads(raw) if raw.strip() else {"retCode": 0, "retMsg": "OK"}
    return data


# ── PÚBLICO — market data de perpetuos (category=linear) ─────────────────────
def public_get(path: str, params: dict, testnet: bool = False):
    return _request("GET", path, params, signed=False, testnet=testnet)


def tickers(symbol: str, testnet: bool = False) -> dict:
    d = public_get("/v5/market/tickers", {"category": "linear", "symbol": symbol}, testnet)
    lst = (d.get("result") or {}).get("list") or []
    if d.get("retCode") != 0 or not lst:
        raise BybitError(f"tickers {symbol}: retCode={d.get('retCode')} {d.get('retMsg')}")
    return lst[0]


def klines(symbol: str, interval: str, limit: int = 300, testnet: bool = False) -> list:
    d = public_get("/v5/market/kline",
                   {"category": "linear", "symbol": symbol, "interval": interval, "limit": limit}, testnet)
    lst = (d.get("result") or {}).get("list") or []
    if d.get("retCode") != 0:
        raise BybitError(f"kline {symbol}: retCode={d.get('retCode')} {d.get('retMsg')}")
    # Bybit devuelve [start, open, high, low, close, volume, turnover] — reciente primero.
    out = [{
        "t": int(c[0]), "o": float(c[1]), "h": float(c[2]),
        "l": float(c[3]), "c": float(c[4]), "v": float(c[5]),
    } for c in lst]
    out.sort(key=lambda x: x["t"])
    return out


def funding_history(symbol: str, limit: int = 50, testnet: bool = False) -> list:
    d = public_get("/v5/market/funding/history",
                   {"category": "linear", "symbol": symbol, "limit": limit}, testnet)
    lst = (d.get("result") or {}).get("list") or []
    return [{"symbol": x.get("symbol"),
             "fundingRate": float(x.get("fundingRate", 0)),
             "fundingRateTimestamp": int(x.get("fundingRateTimestamp", 0))} for x in lst]


# ── PRIVADO — SOLO LECTURA ───────────────────────────────────────────────────
def private_get(path: str, params: dict, testnet: bool = False):
    return _request("GET", path, params, signed=True, testnet=testnet)


def account_state(testnet: bool = False) -> dict:
    """Equity total y posiciones abiertas. SOLO LECTURA. No expone desglose de
    monedas ni direcciones; solo lo mínimo para la app."""
    bal = private_get("/v5/account/wallet-balance", {"accountType": "UNIFIED"}, testnet)
    equity = None
    avail = None
    if bal.get("retCode") == 0:
        row = ((bal.get("result") or {}).get("list") or [{}])[0]
        equity = float(row.get("totalEquity") or 0) or None
        avail = float(row.get("totalAvailableBalance") or 0) or None

    pos = private_get("/v5/position/list", {"category": "linear", "settleCoin": "USDT"}, testnet)
    positions = []
    if pos.get("retCode") == 0:
        for p in (pos.get("result") or {}).get("list") or []:
            size = float(p.get("size") or 0)
            if size <= 0:
                continue
            positions.append({
                "symbol": p.get("symbol"),
                "side": p.get("side"),
                "size": size,
                "entryPrice": float(p.get("avgPrice") or 0),
                "markPrice": float(p.get("markPrice") or 0),
                "leverage": float(p.get("leverage") or 0),
                "unrealizedPnl": float(p.get("unrealisedPnl") or 0),
            })
    return {
        "equity": equity,
        "available": avail,
        "openPositions": len(positions),
        "positions": positions,
        "retCode": bal.get("retCode"),
    }
