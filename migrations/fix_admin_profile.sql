-- Migration: Fix Admin Profile
-- Description: Update existing profile to admin role or create if doesn't exist
-- Usage: Run this SQL in Supabase SQL Editor for your admin user

-- Option 1: Update existing profile to admin (if profile exists)
UPDATE profiles
SET 
    role = 'admin',
    full_name = COALESCE(full_name, 'Антон'),
    is_active = true
WHERE id = (SELECT id FROM auth.users WHERE email = 'ascoldfx@gmail.com');

-- Option 2: Insert only if profile doesn't exist (using ON CONFLICT)
INSERT INTO profiles (id, email, full_name, role)
SELECT 
    id,
    email,
    'Антон',
    'admin'
FROM auth.users
WHERE email = 'ascoldfx@gmail.com'
ON CONFLICT (id) 
DO UPDATE SET 
    role = 'admin',
    full_name = COALESCE(profiles.full_name, 'Антон'),
    is_active = true;

-- Verify the result
SELECT id, email, full_name, role, is_active 
FROM profiles 
WHERE email = 'ascoldfx@gmail.com';

