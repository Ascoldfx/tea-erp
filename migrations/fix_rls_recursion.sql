-- Migration: Fix RLS Infinite Recursion
-- Description: Fix infinite recursion in RLS policies for profiles table
-- Problem: Policies check user role from profiles table, causing recursion
-- Solution: Use SECURITY DEFINER function or simplify policies

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can create profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can delete profiles" ON profiles;

-- Create a function to check if user is admin (using SECURITY DEFINER to bypass RLS)
CREATE OR REPLACE FUNCTION is_admin(user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM profiles
        WHERE id = user_id
        AND role = 'admin'
        AND is_active = true
    );
END;
$$;

-- Allow users to view their own profile
-- (This policy already exists, but we'll recreate it to be sure)
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile"
    ON profiles FOR SELECT
    TO authenticated
    USING (auth.uid() = id);

-- Allow admins to view all profiles (using function to avoid recursion)
CREATE POLICY "Admins can view all profiles"
    ON profiles FOR SELECT
    TO authenticated
    USING (is_admin(auth.uid()));

-- Allow admins to create profiles
CREATE POLICY "Admins can create profiles"
    ON profiles FOR INSERT
    TO authenticated
    WITH CHECK (is_admin(auth.uid()));

-- Allow admins to update profiles
CREATE POLICY "Admins can update profiles"
    ON profiles FOR UPDATE
    TO authenticated
    USING (is_admin(auth.uid()))
    WITH CHECK (is_admin(auth.uid()));

-- Allow admins to delete profiles
CREATE POLICY "Admins can delete profiles"
    ON profiles FOR DELETE
    TO authenticated
    USING (is_admin(auth.uid()));

-- Comment
COMMENT ON FUNCTION is_admin IS 'Check if user is admin (bypasses RLS to avoid recursion)';


