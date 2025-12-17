-- Migration: Delete Test Contractors
-- Description: Remove test/mock contractors from contractors table
-- WARNING: This will delete test contractors. Use with caution!

-- Delete test contractors (those with IDs starting with 'cnt-' or 'supplier-')
-- These are typically mock/test data

DELETE FROM contractors
WHERE id LIKE 'cnt-%' 
   OR id LIKE 'supplier-%'
   OR id IN ('cnt-001', 'cnt-002', 'supplier-001', 'supplier-002', 'supplier-003');

-- Verify deletion
SELECT COUNT(*) as remaining_contractors FROM contractors;

-- Show remaining contractors
SELECT id, name, code, contact_person, phone, email 
FROM contractors 
ORDER BY name;

