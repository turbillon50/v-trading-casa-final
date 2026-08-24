#!/usr/bin/env python3
"""
MODO PAPEL — el corazón de la Fase 7.

Cada operación en papel se ABRE con una tesis escrita (obligatoria), guardando el
funding / OI / basis del momento. Un proceso periódico la MARCA A MERCADO y la
cierra por TP / SL / tiempo, calculando el PnL con la comisión REAL de Bybit
incluida (taker 0.055% por lado, ida y vuelta).

CONVENCIÓN DE TAMAÑO
  size = valor NOCIONAL en USD (capital * apalancamiento).
  qty implícita = size / entry_price.
  comisión_entrada = size * fee_rate
  comisión_salida  = size * (exit/entry) * fee_rate
  gross (long)  = size * (exit/entry - 1)
  gross (short) = size * (1 - exit/entry)
  net = gross - (comisión_entrada + comisión_salida)

Aislado: solo lee/escribe vt_paper_trades. NUNCA toca tablas tanit_*.
"""
import os, sys, json, datetime
import psycopg2, psycopg2.extras
import bybit_client

FEE_TAKER = 0.00055  # 0.055% por lado — comisión real taker de perpetuos Bybit.
MIN_THESIS = 12


def _dsn() -> str:
    dsn = os.environ.get("NEON_DATABASE_URL_TANIT")
    if not dsn:
        raise RuntimeError("NEON_DATABASE_URL_TANIT no está en el entorno")
    return dsn


def _conn():
    c = psycopg2.connect(_dsn())
    c.autocommit = True
    return c


# ── Cálculo puro (testeable sin DB ni red) ───────────────────────────────────
def pnl_breakdown(side: str, size_usd: float, entry: float, exit_: float, fee_rate: float = FEE_TAKER):
    ratio = exit_ / entry
    if side == "long":
        gross = size_usd * (ratio - 1.0)
    elif side == "short":
        gross = size_usd * (1.0 - ratio)
    else:
        raise ValueError("side inválido")
    fee_entry = size_usd * fee_rate
    fee_exit = size_usd * ratio * fee_rate
    fee = fee_entry + fee_exit
    net = gross - fee
    return {"gross": round(gross, 8), "fee": round(fee, 8), "net": round(net, 8)}


def _jsonable(row: dict) -> dict:
    """Convierte Decimal/datetime a tipos JSON-safe para devolver por HTTP."""
    out = {}
    for k, v in dict(row).items():
        if isinstance(v, datetime.datetime):
            out[k] = v.isoformat()
        elif hasattr(v, "__float__") and not isinstance(v, bool):
            out[k] = float(v)
        else:
            out[k] = v
    return out


def _outcome(net: float) -> str:
    if net > 1e-9:
        return "win"
    if net < -1e-9:
        return "loss"
    return "breakeven"


# ── Abrir ────────────────────────────────────────────────────────────────────
def open_trade(symbol: str, side: str, size_usd: float, entry_price: float,
               thesis: str, leverage: float = 1, stop_loss=None, take_profit=None,
               funding=None, oi=None, basis=None, max_hold_hours=None,
               agente_version: str = "papel-v1") -> dict:
    """Registra una operación en papel. SIN TESIS NO SE REGISTRA."""
    if not thesis or len(thesis.strip()) < MIN_THESIS:
        raise ValueError(f"tesis obligatoria (mínimo {MIN_THESIS} caracteres). Sin tesis no se registra.")
    if side not in ("long", "short"):
        raise ValueError("side debe ser 'long' o 'short'")
    if size_usd <= 0 or entry_price <= 0:
        raise ValueError("size y entry_price deben ser > 0")

    with _conn() as c, c.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute("""
            INSERT INTO vt_paper_trades
              (symbol, side, size, entry_price, leverage, stop_loss, take_profit,
               thesis, funding_at_entry, oi_at_entry, basis_at_entry, fee_rate,
               max_hold_hours, agente_version)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            RETURNING id, symbol, side, size, entry_price, opened_at, thesis
        """, (symbol, side, size_usd, entry_price, leverage, stop_loss, take_profit,
              thesis.strip(), funding, oi, basis, FEE_TAKER, max_hold_hours, agente_version))
        row = cur.fetchone()
    return _jsonable(row)


# ── Cerrar (explícito) ───────────────────────────────────────────────────────
def close_trade(trade_id: int, exit_price: float, motivo: str = "manual") -> dict:
    with _conn() as c, c.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute("SELECT * FROM vt_paper_trades WHERE id=%s AND outcome='open'", (trade_id,))
        t = cur.fetchone()
        if not t:
            raise ValueError(f"operación {trade_id} no existe o ya está cerrada")
        b = pnl_breakdown(t["side"], float(t["size"]), float(t["entry_price"]),
                          float(exit_price), float(t["fee_rate"]))
        cur.execute("""
            UPDATE vt_paper_trades
               SET closed_at=now(), exit_price=%s, gross_pnl=%s, fee_estimada=%s,
                   net_pnl=%s, outcome=%s, motivo_cierre=%s, last_mark_price=%s,
                   unrealized_pnl=NULL, last_mtm_at=now()
             WHERE id=%s
            RETURNING id, symbol, side, exit_price, gross_pnl, fee_estimada, net_pnl, outcome, motivo_cierre
        """, (exit_price, b["gross"], b["fee"], b["net"], _outcome(b["net"]),
              motivo, exit_price, trade_id))
        return _jsonable(cur.fetchone())


# ── Marca a mercado + cierre automático por TP/SL/tiempo ─────────────────────
def mark_to_market() -> dict:
    """Un paso. Para cada operación abierta: trae mark price real, actualiza el
    PnL no realizado y cierra si tocó TP/SL o venció el tiempo."""
    closed, updated, errors = [], 0, []
    with _conn() as c, c.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute("SELECT * FROM vt_paper_trades WHERE outcome='open' ORDER BY id")
        opens = cur.fetchall()

    price_cache = {}
    for t in opens:
        sym = t["symbol"]
        try:
            if sym not in price_cache:
                tk = bybit_client.tickers(sym)
                price_cache[sym] = float(tk.get("markPrice") or tk.get("lastPrice"))
            mark = price_cache[sym]
        except Exception as e:
            errors.append({"id": t["id"], "symbol": sym, "error": str(e)[:80]})
            continue

        side, entry, size = t["side"], float(t["entry_price"]), float(t["size"])
        sl = float(t["stop_loss"]) if t["stop_loss"] is not None else None
        tp = float(t["take_profit"]) if t["take_profit"] is not None else None

        # ¿Tocó SL / TP?
        motivo = None
        exit_price = mark
        if side == "long":
            if sl is not None and mark <= sl:
                motivo, exit_price = "stop_loss", sl
            elif tp is not None and mark >= tp:
                motivo, exit_price = "take_profit", tp
        else:  # short
            if sl is not None and mark >= sl:
                motivo, exit_price = "stop_loss", sl
            elif tp is not None and mark <= tp:
                motivo, exit_price = "take_profit", tp

        # ¿Venció el tiempo?
        if motivo is None and t["max_hold_hours"]:
            age_h = (datetime.datetime.now(datetime.timezone.utc) - t["opened_at"]).total_seconds() / 3600.0
            if age_h >= float(t["max_hold_hours"]):
                motivo, exit_price = "tiempo", mark

        if motivo:
            close_trade(t["id"], exit_price, motivo)
            closed.append({"id": t["id"], "symbol": sym, "motivo": motivo, "exit": exit_price})
        else:
            b = pnl_breakdown(side, size, entry, mark, float(t["fee_rate"]))
            with _conn() as c, c.cursor() as cur:
                cur.execute("UPDATE vt_paper_trades SET last_mark_price=%s, unrealized_pnl=%s, last_mtm_at=now() WHERE id=%s",
                            (mark, b["net"], t["id"]))
            updated += 1

    return {"open_evaluadas": len(opens), "cerradas": closed, "actualizadas": updated, "errores": errors}


# ── Métricas acumuladas ──────────────────────────────────────────────────────
def metrics() -> dict:
    with _conn() as c, c.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute("""
            SELECT
              count(*) FILTER (WHERE outcome <> 'open')                        AS cerradas,
              count(*) FILTER (WHERE outcome = 'win')                          AS wins,
              count(*) FILTER (WHERE outcome = 'loss')                         AS losses,
              count(*) FILTER (WHERE outcome = 'open')                         AS abiertas,
              coalesce(sum(net_pnl)   FILTER (WHERE outcome<>'open'),0)        AS net_total,
              coalesce(sum(gross_pnl) FILTER (WHERE outcome<>'open'),0)        AS gross_total,
              coalesce(sum(fee_estimada) FILTER (WHERE outcome<>'open'),0)     AS fees_total,
              coalesce(avg(net_pnl)   FILTER (WHERE outcome='win'),0)          AS avg_win,
              coalesce(avg(net_pnl)   FILTER (WHERE outcome='loss'),0)         AS avg_loss,
              coalesce(sum(unrealized_pnl) FILTER (WHERE outcome='open'),0)    AS unrealized_abierto
            FROM vt_paper_trades
        """)
        m = dict(cur.fetchone())

    cerradas = int(m["cerradas"])
    wins = int(m["wins"])
    net = float(m["net_total"])
    win_rate = (wins / cerradas) if cerradas else 0.0
    expectancy = (net / cerradas) if cerradas else 0.0
    gross = float(m["gross_total"])
    fees = float(m["fees_total"])
    # % del bruto que se comieron las comisiones (la cifra que mató al sistema anterior)
    fee_bite = (fees / abs(gross)) if abs(gross) > 1e-9 else None
    return {
        "cerradas": cerradas,
        "abiertas": int(m["abiertas"]),
        "wins": wins,
        "losses": int(m["losses"]),
        "win_rate": round(win_rate, 4),
        "net_total": round(net, 6),
        "gross_total": round(gross, 6),
        "fees_total": round(fees, 6),
        "fee_bite_ratio": round(fee_bite, 4) if fee_bite is not None else None,
        "expectativa_por_op": round(expectancy, 6),
        "avg_win": round(float(m["avg_win"]), 6),
        "avg_loss": round(float(m["avg_loss"]), 6),
        "unrealized_abierto": round(float(m["unrealized_abierto"]), 6),
    }


def list_trades(limit: int = 100) -> list:
    with _conn() as c, c.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute("""
            SELECT id, symbol, side, size, entry_price, leverage, stop_loss, take_profit,
                   thesis, funding_at_entry, oi_at_entry, basis_at_entry,
                   opened_at, closed_at, exit_price, gross_pnl, fee_estimada, net_pnl,
                   outcome, motivo_cierre, last_mark_price, unrealized_pnl, agente_version
            FROM vt_paper_trades ORDER BY opened_at DESC LIMIT %s
        """, (limit,))
        rows = cur.fetchall()
    out = []
    for r in rows:
        d = dict(r)
        for k, v in d.items():
            if isinstance(v, datetime.datetime):
                d[k] = v.isoformat()
            elif hasattr(v, "__float__") and not isinstance(v, bool):
                d[k] = float(v)
        out.append(d)
    return out


# ── CLI para cron / pruebas ──────────────────────────────────────────────────
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


if __name__ == "__main__":
    _load_dotenv()
    cmd = sys.argv[1] if len(sys.argv) > 1 else "mtm"
    if cmd == "mtm":
        print(json.dumps(mark_to_market(), default=str))
    elif cmd == "metrics":
        print(json.dumps(metrics(), indent=2, default=str))
    elif cmd == "list":
        print(json.dumps(list_trades(), indent=2, default=str))
    else:
        print("uso: paper_engine.py [mtm|metrics|list]")
