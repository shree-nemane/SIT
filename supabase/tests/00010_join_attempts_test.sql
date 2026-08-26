-- ====================================================================
-- STAY IN TOUCH - DATABASE RLS & RPC TEST SUITE FOR PRIORITY 4 (join_attempts & Throttling)
-- Run against a local/staging PostgreSQL or Supabase instance:
-- psql -d stayintouch -f supabase/tests/00010_join_attempts_test.sql
-- ====================================================================

BEGIN;

-- 1. Setup Test User, Group, and Valid Invitation
INSERT INTO auth.users (id, email) VALUES 
  ('77777777-7777-7777-7777-777777777777', 'ownerP4@test.com'),
  ('88888888-8888-8888-8888-888888888888', 'joinerP4@test.com')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.groups (id, name, owner_id) VALUES
  ('77777777-0000-0000-0000-000000000000', 'P4 Test Group', '77777777-7777-7777-7777-777777777777')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.members (id, group_id, display_name, role) VALUES
  ('77777777-7777-7777-7777-777777777777', '77777777-0000-0000-0000-000000000000', 'Owner P4', 'OWNER')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.invitations (id, group_id, created_by, code, status, max_uses, use_count, expires_at) VALUES
  ('77777777-1111-1111-1111-111111111111', '77777777-0000-0000-0000-000000000000', '77777777-7777-7777-7777-777777777777', 'GOOD01', 'active', 5, 0, NOW() + INTERVAL '1 day')
ON CONFLICT (id) DO NOTHING;

-- Helper procedure to simulate identity context
CREATE OR REPLACE FUNCTION public.set_test_identity_p4(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', p_user_id::text, true);
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', p_user_id::text, 'role', 'authenticated')::text, true);
  PERFORM set_config('role', 'authenticated', true);
END;
$$;

-- TEST BLOCK: Execute assertions under authenticated identity for joinerP4
DO $$
DECLARE
  v_res JSONB;
  v_attempts INT;
  v_locked TIMESTAMPTZ;
BEGIN
  -- Set identity to joinerP4 (88888888-8888-8888-8888-888888888888)
  PERFORM public.set_test_identity_p4('88888888-8888-8888-8888-888888888888');

  -- 1. Invalid Format Attempt -> Returns INVALID_FORMAT error
  v_res := public.join_group_with_code('BAD', 'Joiner P4');
  ASSERT (v_res->>'success')::boolean = false, 'TEST 1 FAILED: Short code should return success = false';
  ASSERT (v_res->>'error_code') = 'INVALID_FORMAT', 'TEST 1 FAILED: Short code should return INVALID_FORMAT';

  -- 2. First Invalid Code Attempt -> Returns INVALID_CODE, Increments attempt_count to 1
  v_res := public.join_group_with_code('WRONG1', 'Joiner P4');
  ASSERT (v_res->>'success')::boolean = false, 'TEST 2 FAILED: Wrong code should return success = false';
  ASSERT (v_res->>'error_code') = 'INVALID_CODE', 'TEST 2 FAILED: Wrong code should return INVALID_CODE';

  SELECT attempt_count INTO v_attempts FROM public.join_attempts WHERE user_id = '88888888-8888-8888-8888-888888888888';
  ASSERT v_attempts = 1, 'TEST 2 FAILED: attempt_count should be 1 after first failed attempt.';

  -- 3. Additional Failed Attempts (Attempts 2, 3, 4, 5)
  PERFORM public.join_group_with_code('WRONG2', 'Joiner P4');
  PERFORM public.join_group_with_code('WRONG3', 'Joiner P4');
  PERFORM public.join_group_with_code('WRONG4', 'Joiner P4');
  v_res := public.join_group_with_code('WRONG5', 'Joiner P4');

  SELECT attempt_count, locked_until INTO v_attempts, v_locked FROM public.join_attempts WHERE user_id = '88888888-8888-8888-8888-888888888888';
  ASSERT v_attempts = 5, 'TEST 3 FAILED: attempt_count should reach 5.';
  ASSERT v_locked > NOW(), 'TEST 3 FAILED: locked_until should be set after 5th failed attempt.';

  -- 4. 6th Attempt During Lockout -> Returns RATE_LIMITED
  v_res := public.join_group_with_code('GOOD01', 'Joiner P4');
  ASSERT (v_res->>'success')::boolean = false, 'TEST 4 FAILED: Valid code during active lockout must return success = false';
  ASSERT (v_res->>'error_code') = 'RATE_LIMITED', 'TEST 4 FAILED: Attempt during lockout must return RATE_LIMITED';

  -- 5. Clear Lockout and Try Valid Code -> Returns Success & Clears Attempts
  UPDATE public.join_attempts SET locked_until = NULL, attempt_count = 0 WHERE user_id = '88888888-8888-8888-8888-888888888888';

  v_res := public.join_group_with_code('GOOD01', 'Joiner P4');
  ASSERT (v_res->>'success')::boolean = true, 'TEST 5 FAILED: Valid code should return success = true';
  
  SELECT COUNT(*) INTO v_attempts FROM public.join_attempts WHERE user_id = '88888888-8888-8888-8888-888888888888';
  ASSERT v_attempts = 0, 'TEST 5 FAILED: join_attempts row should be deleted after successful join.';

  RAISE NOTICE 'ALL PRIORITY 4 RPC & RATE-LIMITING ASSERTIONS PASSED SUCCESSFULLY.';
END;
$$;

ROLLBACK;
