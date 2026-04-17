-- Migration 16: campo de posto preenchido pelo colaborador na ordem de serviço
ALTER TABLE service_orders
  ADD COLUMN IF NOT EXISTS employee_posto TEXT;
