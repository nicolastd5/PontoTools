-- ================================================================
-- MIGRATION: Adiciona tabela de contratos e vincula postos (units)
-- ================================================================

CREATE TABLE IF NOT EXISTS contracts (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(150) NOT NULL UNIQUE,
    code        VARCHAR(30)  NOT NULL UNIQUE,
    description TEXT,
    active      BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contracts_code   ON contracts(code);
CREATE INDEX IF NOT EXISTS idx_contracts_active ON contracts(active);

CREATE OR REPLACE TRIGGER trigger_contracts_updated_at
    BEFORE UPDATE ON contracts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Adiciona coluna contract_id em units (opcional, postos podem existir sem contrato)
ALTER TABLE units ADD COLUMN IF NOT EXISTS contract_id INTEGER REFERENCES contracts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_units_contract_id ON units(contract_id);
