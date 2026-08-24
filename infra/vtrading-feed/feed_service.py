#!/usr/bin/env python3
"""
V-TRADING FEED — servicio de datos de Bybit en el Hetzner (puerto 8098).

Existe porque Bybit responde 403 desde Vercel (US) y 200 desde el Hetzner
(Alemania). La app en Vercel consume ESTO por un path nginx autenticado.

Endpoints (todos requieren token salvo /health):
  GET  /health
  GET  /perp/velas?symbol=BTCUSDT&tf=1H
  GET  /perp/ticker?symbol=BTCUSDT   → last/mark/index/funding/OI/basis + anualizado
  GET  /perp/funding?symbol=BTCUSDT&limit=50
  GET  /cuenta/estado                → equity + posiciones abiertas (SOLO LECTURA)
  GET  /paper/list?limit=100
  GET  /paper/metrics
  POST /paper/open   {symbol,side,size_usd,entry_price,thesis,...}  (tesis OBLIGATORIA)
  POST /paper/close  {id,exit_price,motivo}
  POST /paper/mtm

Token: header X-Feed-Token  |  ?token=  |  body {"token":...}
NUNCA imprime llaves ni balances en logs.
"""
import os, json, time, threading
from http.server import HTTPServer, BaseHTTPRequestHandler
from socketserver import ThreadingMixIn
from urllib.parse import urlparse, parse_qs

# ── Cargar /root/.env al entorno del proceso (KEY=VALUE, sin export) ──────────
def _load_dotenv(path="/root/.env"):
    try:
        for line in open(path):
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
    except FileNotFoundError:
        pass

_load_dotenv()

import bybit_client
import paper_engine

PORT = int(os.environ.get("FEED_PORT", "8098"))
TOKEN = os.environ.get("HETZNER_FEED_TOKEN") or os.environ.get("FEED_TOKEN") or ""

TF_TO_INTERVAL = {"1m": "1", "5m": "5", "15m": "15", "1H": "60", "4H": "240",
                  "1D": "D", "1W": "W"}

# ── Cache simple por (path+query) con TTL ────────────────────────────────────
_cache = {}
_cache_lock = threading.Lock()

def cached(key, ttl, producer):
    now = time.time()
    with _cache_lock:
        hit = _cache.get(key)
        if hit and now - hit[0] < ttl:
            return hit[1]
    val = producer()
    with _cache_lock:
        _cache[key] = (now, val)
    return val


def build_ticker(symbol):
    t = bybit_client.tickers(symbol)
    last = float(t.get("lastPrice") or 0)
    mark = float(t.get("markPrice") or 0)
    index = float(t.get("indexPrice") or 0)
    funding = float(t.get("fundingRate") or 0)
    basis = mark - index
    # Funding se cobra cada 8h → 3 veces al día → 1095 al año.
    funding_annual_pct = funding * 3 * 365 * 100
    return {
        "symbol": symbol,
        "lastPrice": last,
        "markPrice": mark,
        "indexPrice": index,
        "fundingRate": funding,
        "fundingAnnualPct": round(funding_annual_pct, 4),
        "nextFundingTime": int(t.get("nextFundingTime") or 0),
        "openInterest": float(t.get("openInterest") or 0),
        "openInterestValue": float(t.get("openInterestValue") or 0),
        "volume24h": float(t.get("volume24h") or 0),
        "turnover24h": float(t.get("turnover24h") or 0),
        "basis": round(basis, 6),
        "basisPct": round((basis / index * 100) if index else 0, 6),
        "price24hPcnt": float(t.get("price24hPcnt") or 0),
        "source": "BYBIT",
        "ts": int(time.time() * 1000),
    }


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *a):  # sin logs verbosos (y sin filtrar nada)
        pass

    def _send(self, code, obj):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _token_ok(self, qs, body):
        if not TOKEN:
            return False  # falla cerrada: sin token configurado, nada pasa
        provided = (self.headers.get("X-Feed-Token")
                    or (qs.get("token", [None])[0])
                    or (body or {}).get("token"))
        return provided == TOKEN

    def _body(self):
        try:
            n = int(self.headers.get("Content-Length") or 0)
            if n <= 0:
                return {}
            return json.loads(self.rfile.read(n).decode() or "{}")
        except Exception:
            return {}

    def do_GET(self):
        u = urlparse(self.path)
        qs = parse_qs(u.query)
        path = u.path.rstrip("/")

        if path == "/health" or path == "":
            return self._send(200, {"ok": True, "service": "vtrading-feed", "ts": int(time.time())})

        if not self._token_ok(qs, None):
            return self._send(401, {"ok": False, "error": "token inválido o ausente"})

        try:
            if path == "/perp/velas":
                symbol = (qs.get("symbol", ["BTCUSDT"])[0]).upper()
                tf = qs.get("tf", ["1H"])[0]
                interval = TF_TO_INTERVAL.get(tf, "60")
                candles = cached(f"velas:{symbol}:{tf}", 15,
                                 lambda: bybit_client.klines(symbol, interval))
                return self._send(200, {"ok": True, "symbol": symbol, "tf": tf,
                                        "source": "BYBIT", "candles": candles,
                                        "ts": int(time.time() * 1000)})

            if path == "/perp/ticker":
                symbol = (qs.get("symbol", ["BTCUSDT"])[0]).upper()
                data = cached(f"ticker:{symbol}", 10, lambda: build_ticker(symbol))
                return self._send(200, {"ok": True, **data})

            if path == "/perp/funding":
                symbol = (qs.get("symbol", ["BTCUSDT"])[0]).upper()
                limit = int(qs.get("limit", ["50"])[0])
                hist = cached(f"funding:{symbol}:{limit}", 60,
                              lambda: bybit_client.funding_history(symbol, limit))
                return self._send(200, {"ok": True, "symbol": symbol, "history": hist})

            if path == "/cuenta/estado":
                data = cached("cuenta", 15, lambda: bybit_client.account_state())
                return self._send(200, {"ok": True, **data})

            if path == "/paper/list":
                limit = int(qs.get("limit", ["100"])[0])
                return self._send(200, {"ok": True, "trades": paper_engine.list_trades(limit)})

            if path == "/paper/metrics":
                return self._send(200, {"ok": True, "metrics": paper_engine.metrics()})

            return self._send(404, {"ok": False, "error": "endpoint no encontrado"})
        except Exception as e:
            # Offline honesto: si Bybit o la DB fallan, se dice claro.
            return self._send(503, {"ok": False, "error": "fuente sin respuesta",
                                    "detail": str(e)[:160]})

    def do_POST(self):
        u = urlparse(self.path)
        qs = parse_qs(u.query)
        path = u.path.rstrip("/")
        body = self._body()

        if not self._token_ok(qs, body):
            return self._send(401, {"ok": False, "error": "token inválido o ausente"})

        try:
            if path == "/paper/open":
                required = ("symbol", "side", "size_usd", "entry_price", "thesis")
                miss = [k for k in required if body.get(k) in (None, "")]
                if miss:
                    return self._send(400, {"ok": False, "error": f"faltan campos: {miss}"})
                row = paper_engine.open_trade(
                    symbol=body["symbol"].upper(), side=body["side"],
                    size_usd=float(body["size_usd"]), entry_price=float(body["entry_price"]),
                    thesis=body["thesis"], leverage=float(body.get("leverage", 1)),
                    stop_loss=body.get("stop_loss"), take_profit=body.get("take_profit"),
                    funding=body.get("funding"), oi=body.get("oi"), basis=body.get("basis"),
                    max_hold_hours=body.get("max_hold_hours"),
                    agente_version=body.get("agente_version", "papel-v1"))
                return self._send(200, {"ok": True, "trade": row})

            if path == "/paper/close":
                row = paper_engine.close_trade(int(body["id"]), float(body["exit_price"]),
                                               body.get("motivo", "manual"))
                return self._send(200, {"ok": True, "trade": row})

            if path == "/paper/mtm":
                return self._send(200, {"ok": True, "result": paper_engine.mark_to_market()})

            return self._send(404, {"ok": False, "error": "endpoint no encontrado"})
        except ValueError as e:
            return self._send(400, {"ok": False, "error": str(e)})
        except Exception as e:
            return self._send(503, {"ok": False, "error": "error interno", "detail": str(e)[:160]})


class ThreadingHTTPServer(ThreadingMixIn, HTTPServer):
    daemon_threads = True


if __name__ == "__main__":
    if not TOKEN:
        print("[feed] ADVERTENCIA: HETZNER_FEED_TOKEN no configurado — todos los endpoints protegidos devolverán 401")
    srv = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print(f"[feed] vtrading-feed escuchando en 127.0.0.1:{PORT}")
    srv.serve_forever()
