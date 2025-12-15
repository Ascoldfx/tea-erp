-- Migration: Add warehouse_id to existing profiles table
-- Run this if profiles table already exists

-- Add warehouse_id column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'warehouse_id'
    ) THEN
        ALTER TABLE profiles ADD COLUMN warehouse_id TEXT REFERENCES warehouses(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Update role check constraint to include 'warehouse'
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check 
    CHECK (role IN ('admin', 'procurement', 'production_planner', 'warehouse', 'director'));

-- Update comments
COMMENT ON COLUMN profiles.role IS 'admin - администратор, procurement - менеджер по закупкам, production_planner - планировщик производства, warehouse - кладовщик, director - директор (только чтение)';
COMMENT ON COLUMN profiles.warehouse_id IS 'Склад, за который отвечает кладовщик (только для роли warehouse)';
