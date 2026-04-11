-- database/10_fcm_token.sql
ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS fcm_token TEXT;
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_fcm
  ON push_subscriptions(fcm_token)
  WHERE fcm_token IS NOT NULL;
