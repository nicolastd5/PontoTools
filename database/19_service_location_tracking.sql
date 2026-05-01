-- Migration 19: rastreamento isolado de localizacao por servico

CREATE TABLE IF NOT EXISTS service_location_updates (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  service_order_id INTEGER NOT NULL REFERENCES service_orders(id) ON DELETE CASCADE,
  unit_id INTEGER NOT NULL REFERENCES units(id) ON DELETE RESTRICT,
  latitude NUMERIC(10,7) NOT NULL,
  longitude NUMERIC(10,7) NOT NULL,
  accuracy_meters NUMERIC(8,2),
  source VARCHAR(20) NOT NULL CHECK (source IN ('web', 'mobile')),
  recorded_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_service_location_service_created
  ON service_location_updates(service_order_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_service_location_employee_created
  ON service_location_updates(employee_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_service_location_unit_created
  ON service_location_updates(unit_id, created_at DESC);
