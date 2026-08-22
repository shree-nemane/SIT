-- ====================================================================
-- STAY IN TOUCH - MIGRATION 00002
-- 1. 24-Hour Invitation Code Expiration & Auto-Revocation of Older Codes
-- 2. Group-Aware Profile Image RLS Policy Fix (members.profile_image_id)
-- ====================================================================

-- 1. FIX IMAGES RLS SELECT POLICY (Group-Aware for both presences & members)
DROP POLICY IF EXISTS "Group members can view presence images" ON public.images;
DROP POLICY IF EXISTS "Group members can view group images" ON public.images;

CREATE POLICY "Group members can view group images"
ON public.images FOR SELECT
TO authenticated
USING (
  uploaded_by = auth.uid() OR
  EXISTS (
    SELECT 1
    FROM public.presences p
    JOIN public.members m ON m.id = p.member_id
    WHERE p.image_id = public.images.id
      AND public.is_group_member(m.group_id)
  ) OR
  EXISTS (
    SELECT 1
    FROM public.members m
    WHERE m.profile_image_id = public.images.id
      AND public.is_group_member(m.group_id)
  )
);

-- 2. RPC: Generate Invitation Code (OWNER-ONLY + 24-HOUR EXPIRATION + AUTO-REVOKE OLD CODES)
CREATE OR REPLACE FUNCTION public.generate_invitation(
    p_code TEXT,
    p_expires_in_days INT DEFAULT NULL,
    p_max_uses INT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    v_group_id UUID;
    v_norm_code TEXT;
    v_invitation_id UUID;
    v_expires_at TIMESTAMPTZ;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    v_norm_code := UPPER(TRIM(p_code));

    -- Enforce 6 uppercase alphanumeric characters
    IF v_norm_code !~ '^[A-Z0-9]{6}$' THEN
        RAISE EXCEPTION 'Invitation code must be exactly 6 alphanumeric characters';
    END IF;

    -- OWNER-ONLY CHECK: Verify caller owns the group
    SELECT id INTO v_group_id
    FROM public.groups
    WHERE owner_id = v_user_id;

    IF v_group_id IS NULL THEN
        RAISE EXCEPTION 'Only the group owner can generate invitation codes';
    END IF;

    -- Set default 24-hour expiration window if not specified
    IF p_expires_in_days IS NOT NULL AND p_expires_in_days > 0 THEN
        v_expires_at := NOW() + (p_expires_in_days || ' days')::INTERVAL;
    ELSE
        v_expires_at := NOW() + INTERVAL '24 hours';
    END IF;

    -- AUTO-EXPIRE OLD CODES: Mark all previous active invitation codes for this group as expired
    UPDATE public.invitations
    SET status = 'expired'
    WHERE group_id = v_group_id AND status = 'active';

    -- Insert new invitation code
    INSERT INTO public.invitations (group_id, code, created_by, created_at, expires_at, max_uses, use_count, status)
    VALUES (v_group_id, v_norm_code, v_user_id, NOW(), v_expires_at, p_max_uses, 0, 'active')
    RETURNING id INTO v_invitation_id;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Invitation code generated successfully',
        'invitation_id', v_invitation_id,
        'code', v_norm_code,
        'expires_at', v_expires_at
    );
END;
$$;

REVOKE ALL ON FUNCTION public.generate_invitation(TEXT, INT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_invitation(TEXT, INT, INT) TO authenticated;

-- 3. RPC: Join Group with Invitation Code (Validates expires_at > NOW())
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
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    v_norm_code := UPPER(TRIM(p_code));

    -- Enforce 6 uppercase alphanumeric characters
    IF v_norm_code !~ '^[A-Z0-9]{6}$' THEN
        RAISE EXCEPTION 'Invitation code must be exactly 6 alphanumeric characters';
    END IF;

    -- Auto-expire any invitations past their expiration window
    UPDATE public.invitations
    SET status = 'expired'
    WHERE status = 'active'
      AND expires_at IS NOT NULL
      AND expires_at <= NOW();

    -- Check if user is already a member of any group
    SELECT * INTO v_member FROM public.members WHERE id = v_user_id;
    IF FOUND THEN
        RETURN jsonb_build_object(
            'success', true,
            'message', 'User already belongs to a group',
            'member', to_jsonb(v_member)
        );
    END IF;

    -- Concurrency-safe invitation code validation with FOR UPDATE row-level lock
    SELECT * INTO v_invitation
    FROM public.invitations
    WHERE code = v_norm_code
      AND status = 'active'
      AND (expires_at IS NULL OR expires_at > NOW())
      AND (max_uses IS NULL OR use_count < max_uses)
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invalid, expired, or fully used invitation code';
    END IF;

    -- Create member record atomically
    INSERT INTO public.members (id, group_id, display_name, joined_at, created_at)
    VALUES (v_user_id, v_invitation.group_id, TRIM(p_display_name), NOW(), NOW())
    RETURNING * INTO v_member;

    -- Update invitation usage tracking
    UPDATE public.invitations
    SET use_count = use_count + 1,
        status = CASE 
            WHEN max_uses IS NOT NULL AND (use_count + 1) >= max_uses THEN 'used' 
            ELSE status 
        END
    WHERE id = v_invitation.id;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Successfully joined group',
        'member', to_jsonb(v_member)
    );
END;
$$;

REVOKE ALL ON FUNCTION public.join_group_with_code(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.join_group_with_code(TEXT, TEXT) TO authenticated;
