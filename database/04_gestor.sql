-- ================================================================
-- MIGRATION: Adiciona role 'gestor' e vincula employees a contratos
-- ================================================================

-- Atualiza o CHECK de role para incluir 'gestor'
ALTER TABLE employees DROP CONSTRAINT IF EXISTS employees_role_check;
ALTER TABLE employees ADD CONSTRAINT employees_role_check
  CHECK (role IN ('employee', 'admin', 'gestor'));

-- Vincula gestor ao seu contrato (employees também podem ter contract_id para filtros futuros)
ALTER TABLE employees ADD COLUMN IF NOT EXISTS contract_id INTEGER REFERENCES contracts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_employees_contract_id ON employees(contract_id);
