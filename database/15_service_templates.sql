-- database/15_service_templates.sql

-- Cria tabela de templates
CREATE TABLE IF NOT EXISTS service_templates (
  id                   SERIAL PRIMARY KEY,
  title                VARCHAR(200) NOT NULL,
  description          TEXT,
  unit_id              INTEGER NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  assigned_employee_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
  due_time             TIME,
  interval_days        INTEGER NOT NULL CHECK (interval_days >= 1),
  start_date           DATE NOT NULL,
  next_run_at          TIMESTAMPTZ NOT NULL,
  active               BOOLEAN NOT NULL DEFAULT TRUE,
  created_by_id        INTEGER NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_service_templates_unit   ON service_templates(unit_id);
CREATE INDEX IF NOT EXISTS idx_service_templates_active ON service_templates(active, next_run_at);

CREATE OR REPLACE TRIGGER trigger_service_templates_updated_at
  BEFORE UPDATE ON service_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Altera service_orders: assigned_employee_id nullable + template_id
ALTER TABLE service_orders
  ALTER COLUMN assigned_employee_id DROP NOT NULL;

ALTER TABLE service_orders
  ADD COLUMN IF NOT EXISTS template_id INTEGER REFERENCES service_templates(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_service_orders_template ON service_orders(template_id);
