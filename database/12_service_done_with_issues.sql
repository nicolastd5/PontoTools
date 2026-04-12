-- Migration 12: adiciona status 'done_with_issues' em service_orders
-- e coluna issue_description para ressalvas ao concluir

-- 1. Adiciona coluna de ressalvas (nullable)
ALTER TABLE service_orders
  ADD COLUMN IF NOT EXISTS issue_description TEXT;

-- 2. Recria o CHECK constraint incluindo o novo status
ALTER TABLE service_orders
  DROP CONSTRAINT IF EXISTS service_orders_status_check;

ALTER TABLE service_orders
  ADD CONSTRAINT service_orders_status_check
    CHECK (status IN ('pending','in_progress','done','done_with_issues','problem'));
