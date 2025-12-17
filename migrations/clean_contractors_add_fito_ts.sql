-- Migration: Clean Contractors and Add Фито, ТС
-- Description: Remove all contractors and add only Фито and ТС (packaging contractors)

-- Step 1: Delete all existing contractors
-- First, delete related data (production orders, material transfers)
-- Note: These tables might not exist yet, so we use DO block to handle gracefully
DO $$
BEGIN
    -- Delete material transfers if table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'material_transfers') THEN
        DELETE FROM material_transfers WHERE contractor_id IN (SELECT id FROM contractors);
    END IF;
    
    -- Delete production orders if table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'production_orders') THEN
        DELETE FROM production_orders WHERE contractor_id IN (SELECT id FROM contractors);
    END IF;
END $$;

-- Delete all contractors
DELETE FROM contractors;

-- Step 2: Add Фито and ТС as contractors
INSERT INTO contractors (id, name, code, contact_person, phone, email)
VALUES
    ('wh-fito', 'Фито', 'FITO', NULL, NULL, NULL),
    ('wh-ts', 'ТС', 'TS', NULL, NULL, NULL)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    code = EXCLUDED.code,
    contact_person = EXCLUDED.contact_person,
    phone = EXCLUDED.phone,
    email = EXCLUDED.email;

-- Step 3: Verify
SELECT id, name, code FROM contractors ORDER BY name;

