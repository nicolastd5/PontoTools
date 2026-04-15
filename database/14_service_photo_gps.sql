-- Migration 14: adiciona coordenadas GPS na foto do serviço
ALTER TABLE service_photos
  ADD COLUMN IF NOT EXISTS latitude  NUMERIC(10,7) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS longitude NUMERIC(10,7) DEFAULT NULL;
