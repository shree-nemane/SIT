-- seed.sql
-- Development Seed Data ONLY (Do NOT execute in Production)
-- Used for local development and integration testing.

DO $$
DECLARE
    v_dev_user_id UUID := 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
    v_dev_group_id UUID := 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22';
BEGIN
    -- Insert test auth user if not present (local dev only)
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, aud)
    VALUES (
        v_dev_user_id,
        '00000000-0000-0000-0000-000000000000',
        'dev_owner@example.com',
        '$2a$10$7EqJtq98hPqEX7fNZaFWoO.L/5l6LqG3r7.n4L3b5e4N3L2e1.vC2',
        NOW(),
        '{"provider":"email","providers":["email"]}',
        '{"name":"Dev Owner"}',
        NOW(),
        NOW(),
        'authenticated',
        'authenticated'
    )
    ON CONFLICT (id) DO NOTHING;

    -- Insert dev test group owned by dev user
    INSERT INTO public.groups (id, name, owner_id, created_at)
    VALUES (v_dev_group_id, 'Development Testing Group', v_dev_user_id, NOW())
    ON CONFLICT (id) DO NOTHING;

    -- Insert dev test member
    INSERT INTO public.members (id, group_id, display_name, joined_at, created_at)
    VALUES (v_dev_user_id, v_dev_group_id, 'Dev Owner', NOW(), NOW())
    ON CONFLICT (id) DO NOTHING;

    -- Insert 6-character dev invitation code SIT202 for testing
    INSERT INTO public.invitations (group_id, code, created_by, status)
    VALUES (v_dev_group_id, 'SIT202', v_dev_user_id, 'active')
    ON CONFLICT (code) DO NOTHING;
END $$;
