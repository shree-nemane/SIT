-- Migration: 00005_invitation_concurrency_and_expiration.sql
-- Description: Enforce 24-hour invitation expiration and group-level transaction locking to guarantee max 1 active code per group.

-- 0. PRE-CLEANUP: If any group currently has multiple active invitations, keep only the newest one and expire older ones
WITH ranked_invitations AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY group_id ORDER BY created_at DESC) as rn
  FROM public.invitations
  WHERE status = 'active'
)
UPDATE public.invitations
SET status = 'expired',
    expires_at = LEAST(COALESCE(expires_at, NOW()), NOW())
WHERE id IN (
  SELECT id FROM ranked_invitations WHERE rn > 1
);

-- 1. STALE INVITATION CLEANUP: Update active invitations past expiration window to 'expired'
UPDATE public.invitations
SET status = 'expired',
    expires_at = LEAST(COALESCE(expires_at, NOW()), NOW())
WHERE status = 'active'
  AND expires_at IS NOT NULL
  AND expires_at <= NOW();

-- 2. Partial Unique Index: Ensure database-level invariant of maximum 1 active invitation per group
CREATE UNIQUE INDEX IF NOT EXISTS idx_invitations_single_active_group
ON public.invitations(group_id)
WHERE status = 'active';

-- 2. RE-DEFINE RPC: generate_invitation (WITH CONCURRENCY LOCKING & FIXED 24H LIFETIME)
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

    -- ACQUIRE TRANSACTION ADVISORY LOCK: Low-collision group-specific advisory lock identifier
    PERFORM pg_advisory_xact_lock(hashtextextended('group_invitation_' || v_group_id::text, 0));

    -- Set default 24-hour expiration window if not specified
    IF p_expires_in_days IS NOT NULL AND p_expires_in_days > 0 THEN
        v_expires_at := NOW() + (p_expires_in_days || ' days')::INTERVAL;
    ELSE
        v_expires_at := NOW() + INTERVAL '24 hours';
    END IF;

    -- ATOMIC EXPIRATION: Expire any existing active invitations for this group immediately
    UPDATE public.invitations
    SET status = 'expired',
        expires_at = NOW()
    WHERE group_id = v_group_id
      AND status = 'active';

    -- INSERT NEW ACTIVE INVITATION
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
