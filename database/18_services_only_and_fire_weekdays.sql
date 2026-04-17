-- Migration 18: campo services_only em job_roles + fire_weekdays em service_templates

-- Cargo "somente serviços" — oculta ponto eletrônico para o funcionário
ALTER TABLE job_roles
  ADD COLUMN IF NOT EXISTS services_only BOOLEAN NOT NULL DEFAULT FALSE;

-- Dias da semana em que o template pode disparar (bitmask: bit0=Dom, bit1=Seg, ..., bit6=Sáb)
-- NULL = todos os dias (comportamento atual)
ALTER TABLE service_templates
  ADD COLUMN IF NOT EXISTS fire_weekdays INTEGER;
