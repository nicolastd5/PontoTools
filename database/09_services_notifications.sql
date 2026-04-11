-- ================================================================
-- MIGRATION: Módulo de Serviços e Notificações
-- ================================================================

-- Ordens de serviço
CREATE TABLE IF NOT EXISTS service_orders (
    id                      SERIAL PRIMARY KEY,
    title                   VARCHAR(200) NOT NULL,
    description             TEXT,
    assigned_employee_id    INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    unit_id                 INTEGER NOT NULL REFERENCES units(id) ON DELETE CASCADE,
    created_by_id           INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    status                  VARCHAR(20) NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending','in_progress','done','problem')),
    scheduled_date          DATE NOT NULL,
    due_time                TIME,
    problem_description     TEXT,
    late_notified           BOOLEAN NOT NULL DEFAULT FALSE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_service_orders_employee ON service_orders(assigned_employee_id);
CREATE INDEX IF NOT EXISTS idx_service_orders_unit     ON service_orders(unit_id);
CREATE INDEX IF NOT EXISTS idx_service_orders_status   ON service_orders(status);
CREATE INDEX IF NOT EXISTS idx_service_orders_date     ON service_orders(scheduled_date);

CREATE OR REPLACE TRIGGER trigger_service_orders_updated_at
    BEFORE UPDATE ON service_orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Fotos das ordens de serviço
CREATE TABLE IF NOT EXISTS service_photos (
    id               SERIAL PRIMARY KEY,
    service_order_id INTEGER NOT NULL REFERENCES service_orders(id) ON DELETE CASCADE,
    phase            VARCHAR(10) NOT NULL CHECK (phase IN ('before','after')),
    photo_path       TEXT NOT NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_service_photos_order ON service_photos(service_order_id);

-- Notificações
CREATE TABLE IF NOT EXISTS notifications (
    id          SERIAL PRIMARY KEY,
    employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    title       VARCHAR(200) NOT NULL,
    body        TEXT NOT NULL,
    type        VARCHAR(30) NOT NULL DEFAULT 'manual'
                    CHECK (type IN ('manual','service_assigned','service_late','service_problem')),
    read        BOOLEAN NOT NULL DEFAULT FALSE,
    push_sent   BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_employee ON notifications(employee_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read     ON notifications(employee_id, read);

-- Subscriptions de Web Push
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id          SERIAL PRIMARY KEY,
    employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    endpoint    TEXT NOT NULL UNIQUE,
    p256dh      TEXT NOT NULL,
    auth        TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_employee ON push_subscriptions(employee_id);
