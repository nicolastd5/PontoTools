-- ================================================================
-- MIGRATION: Extras de registros de ponto
-- - max_photos por cargo
-- - observação no registro
-- ================================================================

-- Campo de quantidade máxima de fotos no cargo
ALTER TABLE job_roles ADD COLUMN IF NOT EXISTS max_photos INTEGER NOT NULL DEFAULT 1;

-- Campo de observação no registro de ponto
ALTER TABLE clock_records ADD COLUMN IF NOT EXISTS observation TEXT;

-- Tabela de fotos adicionais (quando max_photos > 1)
CREATE TABLE IF NOT EXISTS clock_photos (
    id              SERIAL PRIMARY KEY,
    clock_record_id INTEGER NOT NULL REFERENCES clock_records(id) ON DELETE CASCADE,
    photo_path      TEXT    NOT NULL,
    photo_index     INTEGER NOT NULL DEFAULT 1,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clock_photos_record_id ON clock_photos(clock_record_id);
