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
    v_existing RECORD;
BEGIN
    -- 1. Authenticate caller
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Authentication required');
    END IF;

    -- 2. Normalize token
    v_clean_token := trim(COALESCE(p_token, ''));
    IF v_clean_token = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Token cannot be empty');
    END IF;

    -- 3. Validate platform enum
    v_clean_platform := lower(trim(COALESCE(p_platform, 'android')));
    IF v_clean_platform NOT IN ('android', 'ios', 'web') THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Invalid platform specified. Allowed platforms: android, ios, web'
        );
    END IF;

    -- 4. Acquire token-specific transaction lock to serialize concurrent calls
    PERFORM pg_advisory_xact_lock(hashtext(v_clean_token));

    -- 5. Lookup token ownership
    SELECT id, user_id, is_active INTO v_existing
    FROM public.push_devices
    WHERE token = v_clean_token;

    IF FOUND THEN
        -- Different user + active → DENY token hijacking
        IF v_existing.user_id <> v_user_id AND v_existing.is_active = TRUE THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'Push device token is currently active under another user session'
            );
        END IF;

        -- Same user → refresh OR Different user + inactive → transfer
        UPDATE public.push_devices
        SET user_id = v_user_id,
            platform = v_clean_platform,
            provider = 'fcm',
            updated_at = NOW(),
            last_seen_at = NOW(),
            is_active = TRUE
        WHERE token = v_clean_token
        RETURNING id INTO v_device_id;
    ELSE
        -- Token doesn't exist → create
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
        RETURNING id INTO v_device_id;
    END IF;

    -- 6. Return structured result
    RETURN jsonb_build_object(
        'success', true,
        'device_id', v_device_id
    );
EXCEPTION WHEN OTHERS THEN
    -- Do not expose raw SQLERRM to clients
    RETURN jsonb_build_object('success', false, 'error', 'Failed to register push device token');
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

    -- Acquire token-specific advisory transaction lock
    PERFORM pg_advisory_xact_lock(hashtext(v_clean_token));

    UPDATE public.push_devices
    SET is_active = FALSE,
        updated_at = NOW()
    WHERE token = v_clean_token
      AND user_id = v_user_id;

    RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
    -- Do not expose raw SQLERRM to clients
    RETURN jsonb_build_object('success', false, 'error', 'Failed to deactivate push device token');
END;
$$;

-- Grant execution permissions explicitly to authenticated users only
REVOKE ALL ON FUNCTION public.register_push_device(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_push_device(TEXT, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.deactivate_push_device(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.deactivate_push_device(TEXT) TO authenticated;
