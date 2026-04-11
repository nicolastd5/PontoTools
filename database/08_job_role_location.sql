-- ================================================================
-- MIGRATION: Opção de dispensar validação de zona por cargo
-- Se require_location = FALSE, o ponto é aceito de qualquer lugar
-- mas as coordenadas ainda são gravadas normalmente.
-- ================================================================

ALTER TABLE job_roles ADD COLUMN IF NOT EXISTS require_location BOOLEAN NOT NULL DEFAULT TRUE;
