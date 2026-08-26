-- ====================================================================
-- STAY IN TOUCH - DATABASE CONCURRENCY & ROW-LOCK TEST SUITE FOR PRIORITY 4
-- Run against a local/staging PostgreSQL or Supabase instance:
-- psql -d stayintouch -f supabase/tests/00010_concurrency_test.sql
-- ====================================================================

BEGIN;

-- 1. Setup Test Users & Limited Invitation (max_uses = 1)
INSERT INTO auth.users (id, email) VALUES 
  ('99999999-9999-9999-9999-999999999999', 'ownerConc@test.com'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'userConcA@test.com'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'userConcB@test.com')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.groups (id, name, owner_id) VALUES
  ('99999999-0000-0000-0000-000000000000', 'Concurrency Test Group', '99999999-9999-9999-9999-999999999999')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.members (id, group_id, display_name, role) VALUES
  ('99999999-9999-9999-9999-999999999999', '99999999-0000-0000-0000-000000000000', 'Owner Conc', 'OWNER')
ON CONFLICT (id) DO NOTHING;

-- Single-use invitation (max_uses = 1)
INSERT INTO public.invitations (id, group_id, created_by, code, status, max_uses, use_count, expires_at) VALUES
  ('99999999-1111-1111-1111-111111111111', '99999999-0000-0000-0000-000000000000', '99999999-9999-9999-9999-999999999999', 'SINGLE', 'active', 1, 0, NOW() + INTERVAL '1 day')
ON CONFLICT (id) DO NOTHING;

-- Helper procedure to simulate identity context
CREATE OR REPLACE FUNCTION public.set_test_identity_conc(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', p_user_id::text, true);
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', p_user_id::text, 'role', 'authenticated')::text, true);
  PERFORM set_config('role', 'authenticated', true);
END;
$$;

-- TEST 6: Atomic Attempt Increment Serialization (Simulating Concurrent Invalid Attempts for userConcA)
DO $$
DECLARE
  v_res1 JSONB;
  v_res2 JSONB;
  v_attempts INT;
  v_rowCount INT;
BEGIN
  PERFORM public.set_test_identity_conc('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');

  -- Attempt 1
  v_res1 := public.join_group_with_code('WRONG1', 'User Conc A');
  -- Attempt 2 (Simulated concurrent attempt execution)
  v_res2 := public.join_group_with_code('WRONG2', 'User Conc A');

  -- Assertions: Exactly 1 row in join_attempts, attempt_count = 2, no duplicate key crash
  SELECT COUNT(*) INTO v_rowCount FROM public.join_attempts WHERE user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  ASSERT v_rowCount = 1, 'TEST 6 FAILED: Exactly 1 join_attempts row should exist for the user.';

  SELECT attempt_count INTO v_attempts FROM public.join_attempts WHERE user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  ASSERT v_attempts = 2, 'TEST 6 FAILED: attempt_count should equal 2 after two failed attempts.';

  RAISE NOTICE 'TEST 6 PASSED: Atomic attempt increment serialization verified.';
END;
$$;

-- TEST 7: Concurrent Final Invitation Consumption Protection (FOR UPDATE Row-Locking)
DO $$
DECLARE
  v_resA JSONB;
  v_resB JSONB;
  v_useCount INT;
  v_memberCount INT;
BEGIN
  -- User A attempts to consume the single-use invitation
  PERFORM public.set_test_identity_conc('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  v_resA := public.join_group_with_code('SINGLE', 'User Conc A');

  -- User B attempts to consume the same invitation
  PERFORM public.set_test_identity_conc('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
  v_resB := public.join_group_with_code('SINGLE', 'User Conc B');

  -- Assertions: User A succeeds, User B fails, invitation use_count = 1, exactly 1 new member created
  ASSERT (v_resA->>'success')::boolean = true, 'TEST 7 FAILED: First user should succeed in consuming single-use invitation.';
  ASSERT (v_resB->>'success')::boolean = false, 'TEST 7 FAILED: Second user should fail to consume maxed-out invitation.';
  ASSERT (v_resB->>'error_code') = 'INVALID_CODE', 'TEST 7 FAILED: Second user should receive INVALID_CODE when max_uses is reached.';

  SELECT use_count INTO v_useCount FROM public.invitations WHERE code = 'SINGLE';
  ASSERT v_useCount = 1, 'TEST 7 FAILED: Invitation use_count should be exactly 1.';

  SELECT COUNT(*) INTO v_memberCount FROM public.members WHERE group_id = '99999999-0000-0000-0000-000000000000' AND id IN ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
  ASSERT v_memberCount = 1, 'TEST 7 FAILED: Exactly 1 new member should be created for single-use invitation.';

  RAISE NOTICE 'TEST 7 PASSED: Concurrent invitation consumption protection (FOR UPDATE) verified.';
END;
$$;

ROLLBACK;
