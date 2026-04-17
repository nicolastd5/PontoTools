-- Migration 17: quantidade de OS geradas por disparo do template
ALTER TABLE service_templates
  ADD COLUMN IF NOT EXISTS quantity INTEGER NOT NULL DEFAULT 1
    CHECK (quantity BETWEEN 1 AND 40);
