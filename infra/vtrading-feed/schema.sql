-- V-TRADING FASE 7 — MODO PAPEL
-- Tabla NUEVA y aislada. NO toca ninguna tabla existente de Tanit (todas tanit_*).
-- Cada operación en papel DEBE llevar tesis: el CHECK lo impone a nivel de base
-- (el sistema anterior tenía 1630/1666 sin motivo → nunca aprendió nada).

CREATE TABLE IF NOT EXISTS vt_paper_trades (
  id               bigserial PRIMARY KEY,
  symbol           text        NOT NULL,
  side             text        NOT NULL CHECK (side IN ('long','short')),
  -- size = VALOR NOCIONAL de la posición en USD (capital * apalancamiento).
  -- qty implícita = size / entry_price. La comisión se calcula sobre el nocional.
  size             numeric(20,8) NOT NULL CHECK (size > 0),
  entry_price      numeric(20,8) NOT NULL CHECK (entry_price > 0),
  leverage         numeric(10,2) NOT NULL DEFAULT 1,
  stop_loss        numeric(20,8),
  take_profit      numeric(20,8),

  -- OBLIGATORIO: sin tesis no se registra. Guard en base + en app.
  thesis           text        NOT NULL CHECK (length(btrim(thesis)) >= 12),

  -- Contexto de perpetuo capturado en el momento de abrir (lo que antes no existía):
  funding_at_entry numeric(20,10),
  oi_at_entry      numeric(24,4),
  basis_at_entry   numeric(20,8),

  opened_at        timestamptz NOT NULL DEFAULT now(),
  closed_at        timestamptz,
  exit_price       numeric(20,8),

  -- Comisión real de Bybit incluida SIEMPRE (taker por lado, ida y vuelta).
  fee_rate         numeric(10,6) NOT NULL DEFAULT 0.00055,
  gross_pnl        numeric(20,8),
  fee_estimada     numeric(20,8),
  net_pnl          numeric(20,8),

  -- 'open' mientras vive; win/loss/breakeven al cerrar.
  outcome          text        NOT NULL DEFAULT 'open'
                     CHECK (outcome IN ('open','win','loss','breakeven')),
  motivo_cierre    text        CHECK (motivo_cierre IN ('take_profit','stop_loss','tiempo','manual') OR motivo_cierre IS NULL),

  -- Marca a mercado mientras está abierta (proceso periódico):
  last_mark_price  numeric(20,8),
  unrealized_pnl   numeric(20,8),
  last_mtm_at      timestamptz,

  -- Vida máxima antes de cerrar por 'tiempo' (horas). NULL = sin límite.
  max_hold_hours   numeric(10,2),

  agente_version   text        NOT NULL DEFAULT 'papel-v1',
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_vt_paper_open   ON vt_paper_trades (outcome) WHERE outcome = 'open';
CREATE INDEX IF NOT EXISTS ix_vt_paper_symbol ON vt_paper_trades (symbol, opened_at DESC);
