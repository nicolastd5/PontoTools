-- Migration 13: adiciona timestamps de início e conclusão nos serviços
ALTER TABLE service_orders
  ADD COLUMN IF NOT EXISTS started_at  TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS finished_at TIMESTAMPTZ DEFAULT NULL;
