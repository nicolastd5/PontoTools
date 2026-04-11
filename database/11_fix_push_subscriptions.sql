-- Fix: adaptar push_subscriptions para suportar FCM nativo (endpoint nullable)
-- Substitui UNIQUE global por índice partial apenas para endpoints reais (Web Push).

-- 1. Torna endpoint, p256dh e auth opcionais (necessário para registros FCM nativos)
ALTER TABLE push_subscriptions
  ALTER COLUMN endpoint DROP NOT NULL,
  ALTER COLUMN p256dh   DROP NOT NULL,
  ALTER COLUMN auth     DROP NOT NULL;

-- 2. Remove constraint UNIQUE global em endpoint (nome padrão do PostgreSQL)
DO $$
DECLARE
  v_conname TEXT;
BEGIN
  SELECT conname INTO v_conname
  FROM pg_constraint
  WHERE conrelid = 'push_subscriptions'::regclass
    AND contype = 'u'
    AND conname LIKE '%endpoint%'
  LIMIT 1;

  IF v_conname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE push_subscriptions DROP CONSTRAINT %I', v_conname);
  END IF;
END $$;

-- 3. Índice partial UNIQUE para endpoints reais (Web Push) — substitui o UNIQUE removido
CREATE UNIQUE INDEX IF NOT EXISTS idx_push_subscriptions_endpoint_unique
  ON push_subscriptions(endpoint)
  WHERE endpoint IS NOT NULL AND endpoint <> '';

-- 4. Índice partial UNIQUE: um registro FCM por employee
CREATE UNIQUE INDEX IF NOT EXISTS idx_push_subscriptions_fcm_employee
  ON push_subscriptions(employee_id)
  WHERE endpoint IS NULL OR endpoint = '';
