-- ============================================================
-- Stay in Touch
-- Migration: 00007_get_active_invitation_rpc.sql
--
-- Purpose:
--   Allow the group owner to retrieve the existing active
--   invitation code without generating a new one.
--
-- Invitation generation, expiration, concurrency control,
-- and the single-active-invitation constraint are handled
-- by the existing generate_invitation() implementation.
-- ============================================================


-- ------------------------------------------------------------
-- 1. Create / replace the RPC
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_active_invitation()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    v_group_id UUID;
    v_code TEXT;
    v_expires_at TIMESTAMPTZ;
BEGIN
    -- --------------------------------------------------------
    -- Authentication
    -- --------------------------------------------------------

    v_user_id := auth.uid();

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;


    -- --------------------------------------------------------
    -- Resolve the group owned by the authenticated user
    -- --------------------------------------------------------

    SELECT id
    INTO v_group_id
    FROM public.groups
    WHERE owner_id = v_user_id
    LIMIT 1;

    IF v_group_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Only the group owner can view invitation codes'
        );
    END IF;


    -- --------------------------------------------------------
    -- Retrieve the current active, non-expired invitation
    --
    -- The existing database constraint guarantees that a group
    -- can have at most one active invitation.
    -- --------------------------------------------------------

    SELECT code, expires_at
    INTO v_code, v_expires_at
    FROM public.invitations
    WHERE group_id = v_group_id
      AND status = 'active'
      AND expires_at > NOW()
    LIMIT 1;


    -- --------------------------------------------------------
    -- No active invitation exists
    --
    -- The client should call generate_invitation() when this
    -- happens.
    -- --------------------------------------------------------

    IF v_code IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'No active invitation code found'
        );
    END IF;


    -- --------------------------------------------------------
    -- Return the existing invitation
    -- --------------------------------------------------------

    RETURN jsonb_build_object(
        'success', true,
        'code', v_code,
        'expires_at', v_expires_at
    );
END;
$$;


-- ------------------------------------------------------------
-- 2. Restrict RPC execution
-- ------------------------------------------------------------

-- Remove any default/public execution privilege.
REVOKE ALL
ON FUNCTION public.get_active_invitation()
FROM PUBLIC;

-- Only authenticated users can invoke the RPC.
-- The function itself performs the owner authorization check.
GRANT EXECUTE
ON FUNCTION public.get_active_invitation()
TO authenticated;
