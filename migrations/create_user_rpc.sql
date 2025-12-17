-- Migration: Create RPC function for admin user creation
-- Description: Allows admins to create users securely using RPC function
-- This function uses SECURITY DEFINER to bypass RLS for user creation

-- Function to create user (called by admin)
-- Note: This requires service_role key to be used, but we'll call it via RPC
-- The function itself will check if the caller is an admin
CREATE OR REPLACE FUNCTION create_user_by_admin(
    p_email TEXT,
    p_password TEXT,
    p_full_name TEXT,
    p_role TEXT,
    p_warehouse_id TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_profile profiles%ROWTYPE;
    v_caller_role TEXT;
BEGIN
    -- Check if caller is admin
    SELECT role INTO v_caller_role
    FROM profiles
    WHERE id = auth.uid()
    AND is_active = true;

    IF v_caller_role != 'admin' THEN
        RAISE EXCEPTION 'Only admins can create users';
    END IF;

    -- Create user in auth.users using Supabase Auth Admin API
    -- Note: This requires service_role key, so this function should be called
    -- from an Edge Function or backend service with service_role key
    
    -- For now, we'll return an error suggesting to use Edge Function
    -- The actual user creation should be done via Edge Function
    RAISE EXCEPTION 'User creation via RPC requires Edge Function. Please use Edge Function create-user instead.';
END;
$$;

-- Alternative: Create a function that just updates the profile role
-- This can be used after user is created via Supabase Dashboard or signup
CREATE OR REPLACE FUNCTION update_user_role_by_admin(
    p_user_id UUID,
    p_role TEXT,
    p_full_name TEXT DEFAULT NULL,
    p_warehouse_id TEXT DEFAULT NULL
)
RETURNS profiles
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_caller_role TEXT;
    v_updated_profile profiles;
BEGIN
    -- Check if caller is admin
    SELECT role INTO v_caller_role
    FROM profiles
    WHERE id = auth.uid()
    AND is_active = true;

    IF v_caller_role != 'admin' THEN
        RAISE EXCEPTION 'Only admins can update user roles';
    END IF;

    -- Update profile
    UPDATE profiles
    SET 
        role = p_role,
        full_name = COALESCE(p_full_name, full_name),
        warehouse_id = COALESCE(p_warehouse_id, warehouse_id),
        updated_at = NOW()
    WHERE id = p_user_id
    RETURNING * INTO v_updated_profile;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'User profile not found';
    END IF;

    RETURN v_updated_profile;
END;
$$;

COMMENT ON FUNCTION create_user_by_admin IS 'Creates a new user (requires Edge Function with service_role)';
COMMENT ON FUNCTION update_user_role_by_admin IS 'Updates user role and profile (admin only)';


