-- ============================================================
-- Migration 05: Tokens de recuperação de senha
-- ============================================================

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id          SERIAL PRIMARY KEY,
  employee_id INTEGER      NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  token_hash  VARCHAR(64)  NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ  NOT NULL,
  used        BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prt_token_hash   ON password_reset_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_prt_employee_id  ON password_reset_tokens(employee_id);
