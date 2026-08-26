-- ====================================================================
-- STAY IN TOUCH - MIGRATION 00010
-- Security Hardening:
-- 1. Atomic Invitation Code Join Throttling (join_attempts Table)
-- 2. Non-Throwing Atomic join_group_with_code RPC (Preserves Attempt State)
-- 3. Fail-Closed Storage RLS Policies for presence-images Bucket (No Type Cast Errors)
-- ====================================================================

-- 1. ATTEMPT TRACKING TABLE
CREATE TABLE IF NOT EXISTS public.join_attempts (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    attempt_count INT NOT NULL DEFAULT 1,
    first_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    locked_until TIMESTAMPTZ
);

ALTER TABLE public.join_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own join attempts" ON public.join_attempts;
CREATE POLICY "Users can view their own join attempts"
    ON public.join_attempts FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

-- 2. RE-DEFINE RPC: join_group_with_code (NON-THROWING ATOMIC THROTTLING)
CREATE OR REPLACE FUNCTION public.join_group_with_code(p_code TEXT, p_display_name TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    v_norm_code TEXT;
    v_invitation RECORD;
    v_member public.members%ROWTYPE;
    v_attempts public.join_attempts%ROWTYPE;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'UNAUTHENTICATED',
            'message', 'Authentication required'
        );
    END IF;

    v_norm_code := UPPER(TRIM(COALESCE(p_code, '')));

    -- Enforce 6 uppercase alphanumeric characters
    IF v_norm_code !~ '^[A-Z0-9]{6}$' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'INVALID_FORMAT',
            'message', 'Invalid invitation code'
        );
    END IF;

    -- 1. Atomic Attempt Row Lock or Initialization
    INSERT INTO public.join_attempts (user_id, attempt_count, first_attempt_at, locked_until)
    VALUES (v_user_id, 0, NOW(), NULL)
    ON CONFLICT (user_id) DO UPDATE SET user_id = EXCLUDED.user_id
    RETURNING * INTO v_attempts;

    -- 2. Check Active Lockout (15-minute window)
    IF v_attempts.locked_until IS NOT NULL AND v_attempts.locked_until > NOW() THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'RATE_LIMITED',
            'message', 'Too many failed attempts. Please try again in 15 minutes.'
        );
    END IF;

    -- 3. Reset Expired Window (15 minutes)
    IF (v_attempts.locked_until IS NOT NULL AND v_attempts.locked_until <= NOW()) OR
       (v_attempts.first_attempt_at < NOW() - INTERVAL '15 minutes') THEN
        UPDATE public.join_attempts
        SET attempt_count = 0, first_attempt_at = NOW(), locked_until = NULL
        WHERE user_id = v_user_id;
        v_attempts.attempt_count := 0;
    END IF;

    -- Check if user is already a member of any group
    SELECT * INTO v_member FROM public.members WHERE id = v_user_id;
    IF FOUND THEN
        RETURN jsonb_build_object(
            'success', true,
            'message', 'User already belongs to a group',
            'member', to_jsonb(v_member)
        );
    END IF;

    -- 4. Code Validation with Row Lock
    SELECT * INTO v_invitation
    FROM public.invitations
    WHERE code = v_norm_code
      AND status = 'active'
      AND (expires_at IS NULL OR expires_at > NOW())
      AND (max_uses IS NULL OR use_count < max_uses)
    FOR UPDATE;

    IF NOT FOUND THEN
        -- PERSIST FAILED ATTEMPT INCREMENT AND COMMIT (Do not throw exception!)
        UPDATE public.join_attempts
        SET attempt_count = attempt_count + 1,
            locked_until = CASE WHEN attempt_count + 1 >= 5 THEN NOW() + INTERVAL '15 minutes' ELSE NULL END
        WHERE user_id = v_user_id;

        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'INVALID_CODE',
            'message', 'Invalid invitation code'
        );
    END IF;

    -- 5. On Success: Create Member and Clear Attempt Counter
    INSERT INTO public.members (id, group_id, display_name, joined_at, created_at)
    VALUES (v_user_id, v_invitation.group_id, TRIM(p_display_name), NOW(), NOW())
    RETURNING * INTO v_member;

    UPDATE public.invitations
    SET use_count = use_count + 1,
        status = CASE WHEN max_uses IS NOT NULL AND (use_count + 1) >= max_uses THEN 'used' ELSE status END
    WHERE id = v_invitation.id;

    DELETE FROM public.join_attempts WHERE user_id = v_user_id;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Successfully joined group',
        'member', to_jsonb(v_member)
    );
END;
$$;

REVOKE ALL ON FUNCTION public.join_group_with_code(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.join_group_with_code(TEXT, TEXT) TO authenticated;

-- 3. HARDENED FAIL-CLOSED STORAGE RLS POLICIES (presence-images BUCKET)

DROP POLICY IF EXISTS "Authenticated group members can view presence images" ON storage.objects;
DROP POLICY IF EXISTS "Group members can view presence images" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload to their own folder in presence-images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own files in presence-images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own files in presence-images" ON storage.objects;

-- 3.1 SELECT Policy (Strict Same-Group Read via Text Comparison)
CREATE POLICY "Group members can view presence images"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'presence-images' AND
  EXISTS (
    SELECT 1 FROM public.members uploader
    JOIN public.members caller ON caller.group_id = uploader.group_id
    WHERE uploader.id::text = (storage.foldername(name))[1]
      AND caller.id = auth.uid()
  )
);

-- 3.2 INSERT Policy (Strict Own-Namespace Upload to Supported Media Folders)
CREATE POLICY "Users can upload to their own folder in presence-images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'presence-images' AND
  (storage.foldername(name))[1] = auth.uid()::text AND
  (storage.foldername(name))[2] IN ('presence', 'profile')
);

-- 3.3 DELETE Policy (Strict Own-Namespace Deletion from Supported Media Folders)
CREATE POLICY "Users can delete their own files in presence-images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'presence-images' AND
  (storage.foldername(name))[1] = auth.uid()::text AND
  (storage.foldername(name))[2] IN ('presence', 'profile')
);

-- Note: UPDATE policy is intentionally omitted (Minimum Permissions model: images are immutable artifacts).
