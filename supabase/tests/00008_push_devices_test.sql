-- ====================================================================
-- STAY IN TOUCH - DATABASE TEST SUITE FOR VULN-06 (Push Device Token RPC)
-- Run against a local/staging PostgreSQL instance:
-- psql -d stayintouch -f supabase/tests/00008_push_devices_test.sql
-- ====================================================================

BEGIN;

-- 1. Setup Test Users
INSERT INTO auth.users (id, email) VALUES 
  ('11111111-1111-1111-1111-111111111111', 'pushuserA@test.com'),
  ('22222222-2222-2222-2222-222222222222', 'pushuserB@test.com')
ON CONFLICT (id) DO NOTHING;

-- Identity Context Helper
CREATE OR REPLACE FUNCTION public.set_test_identity(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_user_id IS NULL THEN
    PERFORM set_config('request.jwt.claim.sub', '', true);
    PERFORM set_config('request.jwt.claims', '', true);
    PERFORM set_config('role', 'anon', true);
  ELSE
    PERFORM set_config('request.jwt.claim.sub', p_user_id::text, true);
    PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', p_user_id::text, 'role', 'authenticated')::text, true);
    PERFORM set_config('role', 'authenticated', true);
  END IF;
END;
$$;

-- 2. Test 1: Anonymous Caller Rejected
SELECT set_test_identity(NULL);
DO $$
DECLARE
  v_res JSONB;
BEGIN
  v_res := public.register_push_device('fcm_token_123', 'android');
  IF (v_res->>'success')::boolean = FALSE AND v_res->>'error' = 'Authentication required' THEN
    RAISE NOTICE 'TEST 1 PASSED: Anonymous caller rejected cleanly.';
  ELSE
    RAISE EXCEPTION 'TEST 1 FAILED: %', v_res;
  END IF;
END;
$$;

-- 3. Test 2: Platform Enum Validation
SELECT set_test_identity('11111111-1111-1111-1111-111111111111');
DO $$
DECLARE
  v_res JSONB;
BEGIN
  v_res := public.register_push_device('fcm_token_123', 'windows_phone');
  IF (v_res->>'success')::boolean = FALSE AND (v_res->>'error') LIKE 'Invalid platform%' THEN
    RAISE NOTICE 'TEST 2 PASSED: Invalid platform enum rejected.';
  ELSE
    RAISE EXCEPTION 'TEST 2 FAILED: %', v_res;
  END IF;
END;
$$;

-- 4. Test 3: Token Creation for User A
DO $$
DECLARE
  v_res JSONB;
BEGIN
  v_res := public.register_push_device('fcm_token_123', 'android');
  IF (v_res->>'success')::boolean = TRUE AND v_res->>'device_id' IS NOT NULL THEN
    RAISE NOTICE 'TEST 3 PASSED: Push token registered successfully for User A.';
  ELSE
    RAISE EXCEPTION 'TEST 3 FAILED: %', v_res;
  END IF;
END;
$$;

-- 5. Test 4: Token Refresh for Same User (User A)
DO $$
DECLARE
  v_res JSONB;
BEGIN
  v_res := public.register_push_device('fcm_token_123', 'android');
  IF (v_res->>'success')::boolean = TRUE THEN
    RAISE NOTICE 'TEST 4 PASSED: Push token refreshed cleanly for User A.';
  ELSE
    RAISE EXCEPTION 'TEST 4 FAILED: %', v_res;
  END IF;
END;
$$;

-- 6. Test 5: Token Hijacking Attempt by User B while Token is Active (DENIED)
SELECT set_test_identity('22222222-2222-2222-2222-222222222222');
DO $$
DECLARE
  v_res JSONB;
BEGIN
  v_res := public.register_push_device('fcm_token_123', 'android');
  IF (v_res->>'success')::boolean = FALSE AND (v_res->>'error') LIKE 'Push device token is currently active%' THEN
    RAISE NOTICE 'TEST 5 PASSED: Token hijacking by User B while token active was DENIED.';
  ELSE
    RAISE EXCEPTION 'TEST 5 FAILED: Token hijacking protection failed: %', v_res;
  END IF;
END;
$$;

-- 7. Test 6: Deactivation by User A followed by Token Transfer to User B
SELECT set_test_identity('11111111-1111-1111-1111-111111111111');
DO $$
DECLARE
  v_deact JSONB;
  v_res JSONB;
BEGIN
  v_deact := public.deactivate_push_device('fcm_token_123');
  IF (v_deact->>'success')::boolean <> TRUE THEN
    RAISE EXCEPTION 'Deactivation failed: %', v_deact;
  END IF;

  -- Switch to User B
  PERFORM set_test_identity('22222222-2222-2222-2222-222222222222');
  v_res := public.register_push_device('fcm_token_123', 'android');

  IF (v_res->>'success')::boolean = TRUE THEN
    RAISE NOTICE 'TEST 6 PASSED: Token transferred cleanly to User B after User A deactivated token.';
  ELSE
    RAISE EXCEPTION 'TEST 6 FAILED: Token transfer failed: %', v_res;
  END IF;
END;
$$;

ROLLBACK;
