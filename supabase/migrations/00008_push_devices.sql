-- 00008_push_devices.sql
-- FCM Device Token Registration Table, RLS Policies, and Idempotent RPC Functions

-- 1. EXTENSIONS & PUSH_DEVICES TABLE
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.push_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    platform TEXT NOT NULL,
    provider TEXT NOT NULL DEFAULT 'fcm',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT push_devices_token_key UNIQUE (token)
);

-- Index for fast user device lookups
CREATE INDEX IF NOT EXISTS idx_push_devices_user_id ON public.push_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_push_devices_token ON public.push_devices(token);

-- 2. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.push_devices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own push devices" ON public.push_devices;
CREATE POLICY "Users can view their own push devices"
    ON public.push_devices FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own push devices" ON public.push_devices;
CREATE POLICY "Users can insert their own push devices"
    ON public.push_devices FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own push devices" ON public.push_devices;
CREATE POLICY "Users can update their own push devices"
    ON public.push_devices FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own push devices" ON public.push_devices;
CREATE POLICY "Users can delete their own push devices"
    ON public.push_devices FOR DELETE
    USING (auth.uid() = user_id);

-- 3. RPC: register_push_device
CREATE OR REPLACE FUNCTION public.register_push_device(
    p_token TEXT,
    p_platform TEXT DEFAULT 'android'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    v_device_id UUID;
    v_clean_token TEXT;
    v_clean_platform TEXT;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Authentication required');
    END IF;

    v_clean_token := trim(COALESCE(p_token, ''));
    IF v_clean_token = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Token cannot be empty');
    END IF;

    v_clean_platform := lower(trim(COALESCE(p_platform, 'android')));

    -- Upsert token cleanly. Handles reinstall / user reassignment / token refresh deterministically.
    INSERT INTO public.push_devices (
        user_id,
        token,
        platform,
        provider,
        created_at,
        updated_at,
        last_seen_at,
        is_active
    ) VALUES (
        v_user_id,
        v_clean_token,
        v_clean_platform,
        'fcm',
        NOW(),
        NOW(),
        NOW(),
        TRUE
    )
    ON CONFLICT (token) DO UPDATE SET
        user_id = EXCLUDED.user_id,
        platform = EXCLUDED.platform,
        provider = 'fcm',
        updated_at = NOW(),
        last_seen_at = NOW(),
        is_active = TRUE
    RETURNING id INTO v_device_id;

    RETURN jsonb_build_object(
        'success', true,
        'device_id', v_device_id
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- 4. RPC: deactivate_push_device
CREATE OR REPLACE FUNCTION public.deactivate_push_device(
    p_token TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    v_clean_token TEXT;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Authentication required');
    END IF;

    v_clean_token := trim(COALESCE(p_token, ''));
    IF v_clean_token = '' THEN
        RETURN jsonb_build_object('success', true);
    END IF;

    UPDATE public.push_devices
    SET is_active = FALSE,
        updated_at = NOW()
    WHERE token = v_clean_token
      AND user_id = v_user_id;

    RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Grant execution permissions explicitly to authenticated users only
REVOKE ALL ON FUNCTION public.register_push_device(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_push_device(TEXT, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.deactivate_push_device(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.deactivate_push_device(TEXT) TO authenticated;
