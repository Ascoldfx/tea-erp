-- Migration: Clean Contractors and Add Фито, ТС
-- Description: Remove all contractors and add only Фито and ТС (packaging contractors)

-- Step 1: Delete all existing contractors
-- First, delete related data (production orders, material transfers)
DELETE FROM material_transfers WHERE contractor_id IN (SELECT id FROM contractors);
DELETE FROM production_orders WHERE contractor_id IN (SELECT id FROM contractors);

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

