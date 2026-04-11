-- Fix: endpoint não deve ter UNIQUE constraint global pois FCM usa endpoint vazio.
-- Substitui por índice partial que só aplica UNIQUE em endpoints reais (Web Push).

ALTER TABLE push_subscriptions
  ALTER COLUMN endpoint DROP NOT NULL,
  ALTER COLUMN p256dh   DROP NOT NULL,
  ALTER COLUMN auth     DROP NOT NULL;

-- Remove constraint UNIQUE global (pode ter nome diferente; usamos IF EXISTS via índice)
DO $$
BEGIN
  -- Tenta remover pelo nome padrão gerado pelo PostgreSQL
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'push_subscriptions'::regclass
      AND contype = 'u'
      AND conname LIKE '%endpoint%'
  ) THEN
    EXECUTE (
      SELECT 'ALTER TABLE push_subscriptions DROP CONSTRAINT ' || conname
      FROM pg_constraint
      WHERE conrelid = 'push_subscriptions'::regclass
        AND contype = 'u'
        AND conname LIKE '%endpoint%'
      LIMIT 1
    );
  END IF;
END $$;

-- Índice partial: UNIQUE apenas para endpoints reais (Web Push)
CREATE UNIQUE INDEX IF NOT EXISTS idx_push_subscriptions_endpoint_unique
  ON push_subscriptions(endpoint)
  WHERE endpoint IS NOT NULL AND endpoint <> '';

-- Índice partial: um token FCM por employee
CREATE UNIQUE INDEX IF NOT EXISTS idx_push_subscriptions_fcm_employee
  ON push_subscriptions(employee_id)
  WHERE fcm_token IS NOT NULL AND (endpoint IS NULL OR endpoint = '');
