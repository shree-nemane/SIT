-- 00009_presence_push_webhook.sql
-- Documentation & Database Webhook Configuration for dispatch-presence-push Edge Function
--
-- Event Flow:
--   presence INSERT/UPDATE or member UPDATE
--       ↓
--   transaction succeeds (PostgreSQL)
--       ↓
--   Supabase Database Webhook / pg_net event
--       ↓
--   dispatch-presence-push Edge Function
--       ↓
--   Firebase Cloud Messaging (FCM) HTTP v1
--       ↓
--   receiving devices (silent wake-up data message)
--

-- Enable pg_net extension if available (optional for direct SQL http triggers)
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Comment for database administration and deployment documentation
COMMENT ON TABLE public.push_devices IS 'Registered FCM device tokens for group member background widget push notifications';
