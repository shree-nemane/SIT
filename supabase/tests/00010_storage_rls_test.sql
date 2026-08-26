-- ====================================================================
-- STAY IN TOUCH - DATABASE RLS TEST SUITE FOR PRIORITY 3 (storage.objects)
-- Run against a local/staging PostgreSQL or Supabase instance:
-- psql -d stayintouch -f supabase/tests/00010_storage_rls_test.sql
-- ====================================================================

BEGIN;

-- 1. Setup Test Users & Groups
INSERT INTO auth.users (id, email) VALUES 
  ('11111111-1111-1111-1111-111111111111', 'userA@test.com'),
  ('22222222-2222-2222-2222-222222222222', 'userB@test.com'),
  ('33333333-3333-3333-3333-333333333333', 'userC@test.com')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.groups (id, name, owner_id) VALUES
  ('aaaaaa11-1111-1111-1111-111111111111', 'Group 1', '11111111-1111-1111-1111-111111111111'),
  ('bbbbbb22-2222-2222-2222-222222222222', 'Group 2', '33333333-3333-3333-3333-333333333333')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.members (id, group_id, display_name, role) VALUES
  ('11111111-1111-1111-1111-111111111111', 'aaaaaa11-1111-1111-1111-111111111111', 'User A', 'OWNER'),
  ('22222222-2222-2222-2222-222222222222', 'aaaaaa11-1111-1111-1111-111111111111', 'User B', 'MEMBER'),
  ('33333333-3333-3333-3333-333333333333', 'bbbbbb22-2222-2222-2222-222222222222', 'User C', 'OWNER')
ON CONFLICT (id) DO NOTHING;

-- 2. Seed Test Media Objects into storage.objects
INSERT INTO storage.objects (id, bucket_id, name, owner) VALUES
  ('10000000-0000-0000-0000-000000000001', 'presence-images', '11111111-1111-1111-1111-111111111111/presence/picA.jpg', '11111111-1111-1111-1111-111111111111'),
  ('20000000-0000-0000-0000-000000000002', 'presence-images', '22222222-2222-2222-2222-222222222222/profile/picB.jpg', '22222222-2222-2222-2222-222222222222'),
  ('30000000-0000-0000-0000-000000000003', 'presence-images', '33333333-3333-3333-3333-333333333333/presence/picC.jpg', '33333333-3333-3333-3333-333333333333')
ON CONFLICT (id) DO NOTHING;

-- Helper procedure to simulate identity context safely for tests
-- Sets both request.jwt.claim.sub and request.jwt.claims JSON + authenticated role
CREATE OR REPLACE FUNCTION public.set_test_identity(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', p_user_id::text, true);
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', p_user_id::text, 'role', 'authenticated')::text, true);
  PERFORM set_config('role', 'authenticated', true);
END;
$$;

-- TEST BLOCK: Execute assertions under authenticated non-bypass identities
DO $$
DECLARE
  v_count INT;
BEGIN
  -- TEST 1: Same-Group Image Read (User A -> User B's Image in Group 1) -> EXPECT ALLOWED
  PERFORM public.set_test_identity('11111111-1111-1111-1111-111111111111');
  SELECT COUNT(*) INTO v_count 
  FROM storage.objects 
  WHERE name = '22222222-2222-2222-2222-222222222222/profile/picB.jpg';
  ASSERT v_count = 1, 'TEST 1 FAILED: User A should be allowed to view User B image in same group.';

  -- TEST 2: Cross-Group Image Read (User A -> User C's Image in Group 2) -> EXPECT DENIED
  PERFORM public.set_test_identity('11111111-1111-1111-1111-111111111111');
  SELECT COUNT(*) INTO v_count 
  FROM storage.objects 
  WHERE name = '33333333-3333-3333-3333-333333333333/presence/picC.jpg';
  ASSERT v_count = 0, 'TEST 2 FAILED: User A must be DENIED cross-group read on User C image.';

  -- TEST 3: Own Namespace Upload to Supported Folder -> EXPECT ALLOWED
  PERFORM public.set_test_identity('11111111-1111-1111-1111-111111111111');
  INSERT INTO storage.objects (id, bucket_id, name, owner)
  VALUES ('10000000-0000-0000-0000-000000000099', 'presence-images', '11111111-1111-1111-1111-111111111111/presence/testNewA.jpg', '11111111-1111-1111-1111-111111111111');

  -- TEST 4: Own Namespace Deletion -> EXPECT ALLOWED
  PERFORM public.set_test_identity('11111111-1111-1111-1111-111111111111');
  DELETE FROM storage.objects WHERE id = '10000000-0000-0000-0000-000000000099';

  RAISE NOTICE 'ALL DATABASE RLS ASSERTIONS PASSED SUCCESSFULLY.';
END;
$$;

ROLLBACK;
