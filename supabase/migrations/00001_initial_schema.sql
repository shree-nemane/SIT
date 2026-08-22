-- 00001_initial_schema.sql
-- Production Core Schema, Hardened RLS Policies, Private Storage Setup, and Atomic RPC Functions

-- 1. CORE TABLES

-- 1.1 GROUPS TABLE (MVP single-group system with required owner_id)
CREATE TABLE IF NOT EXISTS public.groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1.2 IMAGES TABLE (Presence and profile images metadata with explicit uploader ownership)
CREATE TABLE IF NOT EXISTS public.images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    storage_path TEXT NOT NULL,
    width INTEGER NOT NULL DEFAULT 0,
    height INTEGER NOT NULL DEFAULT 0,
    file_size INTEGER NOT NULL DEFAULT 0,
    uploaded_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1.3 MEMBERS TABLE (Auth identity and member separation, profile_image_id FK to images)
CREATE TABLE IF NOT EXISTS public.members (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    display_name TEXT NOT NULL,
    profile_image_id UUID REFERENCES public.images(id) ON DELETE SET NULL,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1.4 PRESENCES TABLE (Exactly one active Presence per member, image_id FK to images)
CREATE TABLE IF NOT EXISTS public.presences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL UNIQUE REFERENCES public.members(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    image_id UUID REFERENCES public.images(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1.5 INVITATIONS TABLE (Supports both reusable and single-use 6-character codes)
CREATE TABLE IF NOT EXISTS public.invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    code TEXT NOT NULL UNIQUE,
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    max_uses INT DEFAULT NULL, -- NULL means reusable unlimited times
    use_count INT NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'used', 'expired', 'revoked'))
);

-- 2. ROW LEVEL SECURITY (RLS) POLICIES

ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.presences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- Security Definer Helper for Group Membership Check
CREATE OR REPLACE FUNCTION public.is_group_member(check_group_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.members
    WHERE id = auth.uid() AND group_id = check_group_id
  );
$$;

REVOKE ALL ON FUNCTION public.is_group_member(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_group_member(UUID) TO authenticated;

-- 2.1 Groups RLS Policies
CREATE POLICY "Group members and owners can view group"
ON public.groups FOR SELECT
TO authenticated
USING (public.is_group_member(id) OR owner_id = auth.uid());

CREATE POLICY "Group owner can update group details"
ON public.groups FOR UPDATE
TO authenticated
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

-- 2.2 Members RLS Policies (Direct client INSERT permission REMOVED)
CREATE POLICY "Members can view co-members in their group"
ON public.members FOR SELECT
TO authenticated
USING (public.is_group_member(group_id));

CREATE POLICY "Users can update their own member profile"
ON public.members FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- 2.3 Presences RLS Policies
CREATE POLICY "Members can view presences in their group"
ON public.presences FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.id = public.presences.member_id
    AND public.is_group_member(m.group_id)
  )
);

CREATE POLICY "Users can manage their own presence"
ON public.presences FOR ALL
TO authenticated
USING (member_id = auth.uid())
WITH CHECK (member_id = auth.uid());

-- 2.4 Images RLS Policies (Group-Aware View + Uploader Ownership)
CREATE POLICY "Group members can view presence images"
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
  )
);

CREATE POLICY "Users can insert their own image metadata"
ON public.images FOR INSERT
TO authenticated
WITH CHECK (uploaded_by = auth.uid());

CREATE POLICY "Users can update their own image metadata"
ON public.images FOR UPDATE
TO authenticated
USING (uploaded_by = auth.uid())
WITH CHECK (uploaded_by = auth.uid());

CREATE POLICY "Users can delete their own image metadata"
ON public.images FOR DELETE
TO authenticated
USING (uploaded_by = auth.uid());

-- 2.5 Invitations Table Security:
-- Direct client SELECT/INSERT/UPDATE policies are intentionally omitted.
-- Access to invitations is strictly controlled server-side via RPC functions.

-- 3. PRIVATE SUPABASE STORAGE BUCKET SETUP

INSERT INTO storage.buckets (id, name, public)
VALUES ('presence-images', 'presence-images', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- Storage RLS Policies (Group Member Read + Folder Uploader Ownership)
CREATE POLICY "Authenticated group members can view presence images"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'presence-images' AND (
    (storage.foldername(name))[1] = auth.uid()::text OR
    EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.id = auth.uid()
    )
  )
);

CREATE POLICY "Users can upload to their own folder in presence-images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'presence-images' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can update their own files in presence-images"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'presence-images' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete their own files in presence-images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'presence-images' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- 4. HARDENED SECURITY DEFINER RPC FUNCTIONS

-- 4.1 RPC: Create New Group & Become Owner (Enforces Exactly One Group in v0.1 Concurrency-Safely)
CREATE OR REPLACE FUNCTION public.create_group(p_group_name TEXT, p_display_name TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    v_group_id UUID;
    v_existing_count INT;
    v_member public.members%ROWTYPE;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Concurrency-safe lock to guarantee strictly one group in v0.1 system
    LOCK TABLE public.groups IN EXCLUSIVE MODE;

    SELECT COUNT(*) INTO v_existing_count FROM public.groups;
    IF v_existing_count > 0 THEN
        RAISE EXCEPTION 'A group already exists in the system. Single-group system limit reached.';
    END IF;

    -- Check if user is already a member of any group
    SELECT * INTO v_member FROM public.members WHERE id = v_user_id;
    IF FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'User already belongs to a group',
            'member', to_jsonb(v_member)
        );
    END IF;

    -- Create single group with caller as owner
    INSERT INTO public.groups (name, owner_id, created_at)
    VALUES (TRIM(p_group_name), v_user_id, NOW())
    RETURNING id INTO v_group_id;

    -- Add owner as first member
    INSERT INTO public.members (id, group_id, display_name, joined_at, created_at)
    VALUES (v_user_id, v_group_id, TRIM(p_display_name), NOW(), NOW())
    RETURNING * INTO v_member;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Group created successfully',
        'group_id', v_group_id,
        'member', to_jsonb(v_member)
    );
END;
$$;

REVOKE ALL ON FUNCTION public.create_group(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_group(TEXT, TEXT) TO authenticated;

-- 4.2 RPC: Join Group with Invitation Code (Concurrency-Safe Row Lock + 6-Char Alphanumeric Validation)
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

-- 4.3 RPC: Generate Invitation Code (OWNER-ONLY + 6-Char Format Validation)
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
    v_expires_at TIMESTAMPTZ := NULL;
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

    IF p_expires_in_days IS NOT NULL THEN
        v_expires_at := NOW() + (p_expires_in_days || ' days')::INTERVAL;
    END IF;

    INSERT INTO public.invitations (group_id, code, created_by, created_at, expires_at, max_uses, use_count, status)
    VALUES (v_group_id, v_norm_code, v_user_id, NOW(), v_expires_at, p_max_uses, 0, 'active')
    RETURNING id INTO v_invitation_id;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Invitation created successfully by group owner',
        'code', v_norm_code,
        'invitation_id', v_invitation_id
    );
END;
$$;

REVOKE ALL ON FUNCTION public.generate_invitation(TEXT, INT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_invitation(TEXT, INT, INT) TO authenticated;
