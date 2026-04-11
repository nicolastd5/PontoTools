-- ================================================================
-- MIGRATION: Tabela de cargos (job_roles)
-- Permite configurar se o cargo tem intervalo ou não
-- ================================================================

CREATE TABLE IF NOT EXISTS job_roles (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(100) NOT NULL UNIQUE,
    description     TEXT,
    has_break       BOOLEAN      NOT NULL DEFAULT TRUE,
    active          BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_roles_active ON job_roles(active);

CREATE OR REPLACE TRIGGER trigger_job_roles_updated_at
    BEFORE UPDATE ON job_roles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Vincula cargo ao funcionário (opcional)
ALTER TABLE employees ADD COLUMN IF NOT EXISTS job_role_id INTEGER REFERENCES job_roles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_employees_job_role_id ON employees(job_role_id);
