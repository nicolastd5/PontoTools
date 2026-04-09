-- ================================================================
-- SISTEMA DE PONTO ELETRÔNICO COM GPS E FOTO
-- Script de criação do schema do banco de dados
-- ================================================================

-- Extensão para UUID (opcional, usamos SERIAL por padrão)
-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ================================================================
-- TABELA: units (unidades)
-- Cada unidade tem um centro GPS e raio de validação configurável
-- ================================================================
CREATE TABLE IF NOT EXISTS units (
    id             SERIAL PRIMARY KEY,
    name           VARCHAR(100)  NOT NULL UNIQUE,
    code           VARCHAR(20)   NOT NULL UNIQUE,
    latitude       NUMERIC(10,7) NOT NULL,
    longitude      NUMERIC(10,7) NOT NULL,
    radius_meters  INTEGER       NOT NULL DEFAULT 100,
    address        TEXT,
    active         BOOLEAN       NOT NULL DEFAULT TRUE,
    created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_units_code   ON units(code);
CREATE INDEX IF NOT EXISTS idx_units_active ON units(active);

-- ================================================================
-- TABELA: employees (funcionários)
-- role: 'admin' vê todas as unidades | 'employee' vê só a sua
-- ================================================================
CREATE TABLE IF NOT EXISTS employees (
    id             SERIAL PRIMARY KEY,
    unit_id        INTEGER       NOT NULL REFERENCES units(id) ON DELETE RESTRICT,
    badge_number   VARCHAR(30)   NOT NULL UNIQUE,
    full_name      VARCHAR(150)  NOT NULL,
    email          VARCHAR(200)  NOT NULL UNIQUE,
    password_hash  VARCHAR(255)  NOT NULL,
    role           VARCHAR(20)   NOT NULL DEFAULT 'employee'
                   CHECK (role IN ('employee', 'admin')),
    active         BOOLEAN       NOT NULL DEFAULT TRUE,
    created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_employees_unit_id ON employees(unit_id);
CREATE INDEX IF NOT EXISTS idx_employees_email   ON employees(email);
CREATE INDEX IF NOT EXISTS idx_employees_badge   ON employees(badge_number);
CREATE INDEX IF NOT EXISTS idx_employees_active  ON employees(active);
CREATE INDEX IF NOT EXISTS idx_employees_role    ON employees(role);

-- ================================================================
-- TABELA: clock_records (registros de ponto aprovados)
-- Apenas registros que passaram na validação de zona chegam aqui.
-- Registros fora da zona ainda são gravados com is_inside_zone=false
-- para auditoria (ex: admin autorizou exceção).
-- ================================================================
CREATE TABLE IF NOT EXISTS clock_records (
    id              SERIAL PRIMARY KEY,
    employee_id     INTEGER       NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
    unit_id         INTEGER       NOT NULL REFERENCES units(id)     ON DELETE RESTRICT,
    clock_type      VARCHAR(20)   NOT NULL
                    CHECK (clock_type IN ('entry', 'exit', 'break_start', 'break_end')),
    -- Tempo: armazenado em UTC, fuso do dispositivo gravado separadamente
    clocked_at_utc  TIMESTAMPTZ   NOT NULL,
    timezone        VARCHAR(60)   NOT NULL,
    -- Localização GPS do dispositivo no momento da batida
    latitude        NUMERIC(10,7) NOT NULL,
    longitude       NUMERIC(10,7) NOT NULL,
    accuracy_meters NUMERIC(8,2),
    distance_meters NUMERIC(8,2)  NOT NULL,
    -- Validação de zona
    is_inside_zone  BOOLEAN       NOT NULL,
    -- Foto capturada ao vivo
    photo_path      TEXT          NOT NULL,
    -- Metadados do dispositivo
    device_info     JSONB,
    ip_address      INET,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clock_employee_id    ON clock_records(employee_id);
CREATE INDEX IF NOT EXISTS idx_clock_unit_id        ON clock_records(unit_id);
CREATE INDEX IF NOT EXISTS idx_clock_clocked_at_utc ON clock_records(clocked_at_utc DESC);
CREATE INDEX IF NOT EXISTS idx_clock_type           ON clock_records(clock_type);
-- Índice composto para consultas por funcionário + período
CREATE INDEX IF NOT EXISTS idx_clock_employee_date  ON clock_records(employee_id, clocked_at_utc DESC);
-- Índice composto para consultas por unidade + período
CREATE INDEX IF NOT EXISTS idx_clock_unit_date      ON clock_records(unit_id, clocked_at_utc DESC);

-- ================================================================
-- TABELA: blocked_attempts (tentativas bloqueadas / fraudes)
-- Registra toda tentativa de bater ponto que foi impedida.
-- employee_id pode ser NULL se o token for inválido.
-- ================================================================
CREATE TABLE IF NOT EXISTS blocked_attempts (
    id              SERIAL PRIMARY KEY,
    employee_id     INTEGER       REFERENCES employees(id) ON DELETE SET NULL,
    unit_id         INTEGER       REFERENCES units(id)     ON DELETE SET NULL,
    attempted_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    block_reason    VARCHAR(50)   NOT NULL
                    CHECK (block_reason IN (
                        'gps_disabled',
                        'outside_zone',
                        'camera_denied',
                        'rate_limited',
                        'invalid_payload'
                    )),
    -- Coordenadas podem ser NULL se GPS estava desligado
    latitude        NUMERIC(10,7),
    longitude       NUMERIC(10,7),
    distance_meters NUMERIC(8,2),
    timezone        VARCHAR(60),
    ip_address      INET,
    device_info     JSONB,
    -- Payload bruto para auditoria (sem foto)
    raw_payload     JSONB
);

CREATE INDEX IF NOT EXISTS idx_blocked_employee_id ON blocked_attempts(employee_id);
CREATE INDEX IF NOT EXISTS idx_blocked_unit_id     ON blocked_attempts(unit_id);
CREATE INDEX IF NOT EXISTS idx_blocked_at          ON blocked_attempts(attempted_at DESC);
CREATE INDEX IF NOT EXISTS idx_blocked_reason      ON blocked_attempts(block_reason);

-- ================================================================
-- TABELA: refresh_tokens
-- Hash SHA-256 do token real (nunca o token em si)
-- ================================================================
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id           SERIAL PRIMARY KEY,
    employee_id  INTEGER      NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    token_hash   VARCHAR(255) NOT NULL UNIQUE,
    expires_at   TIMESTAMPTZ  NOT NULL,
    revoked      BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refresh_employee_id ON refresh_tokens(employee_id);
CREATE INDEX IF NOT EXISTS idx_refresh_token_hash  ON refresh_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_refresh_revoked     ON refresh_tokens(revoked, expires_at);

-- ================================================================
-- TABELA: audit_logs (trilha de auditoria de ações administrativas)
-- Toda ação de escrita feita por um admin é registrada aqui.
-- ================================================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id           SERIAL PRIMARY KEY,
    admin_id     INTEGER      NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
    action       VARCHAR(100) NOT NULL,
    target_type  VARCHAR(50),
    target_id    INTEGER,
    old_value    JSONB,
    new_value    JSONB,
    ip_address   INET,
    performed_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_admin_id     ON audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_audit_performed_at ON audit_logs(performed_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action       ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_target       ON audit_logs(target_type, target_id);

-- ================================================================
-- FUNÇÃO: atualiza updated_at automaticamente
-- ================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trigger_units_updated_at
    BEFORE UPDATE ON units
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER trigger_employees_updated_at
    BEFORE UPDATE ON employees
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
