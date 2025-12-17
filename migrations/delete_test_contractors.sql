-- Migration: Delete Test Contractors
-- Description: Remove test/mock contractors from contractors table
-- WARNING: This will delete test contractors and all related data (orders, order items). Use with caution!

-- Step 1: Find test contractor IDs
-- This will show which contractors will be deleted
SELECT id, name, code 
FROM contractors 
WHERE id LIKE 'cnt-%' 
   OR id LIKE 'supplier-%'
   OR id IN ('cnt-001', 'cnt-002', 'supplier-001', 'supplier-002', 'supplier-003')
ORDER BY name;

-- Step 2: Delete order_items for orders from test contractors
-- First, delete order items that belong to orders from test contractors
DELETE FROM order_items
WHERE order_id IN (
    SELECT id FROM orders 
    WHERE contractor_id IN (
        SELECT id FROM contractors 
        WHERE id LIKE 'cnt-%' 
           OR id LIKE 'supplier-%'
           OR id IN ('cnt-001', 'cnt-002', 'supplier-001', 'supplier-002', 'supplier-003')
    )
);

-- Step 3: Delete orders from test contractors
DELETE FROM orders
WHERE contractor_id IN (
    SELECT id FROM contractors 
    WHERE id LIKE 'cnt-%' 
       OR id LIKE 'supplier-%'
       OR id IN ('cnt-001', 'cnt-002', 'supplier-001', 'supplier-002', 'supplier-003')
);

-- Step 4: Delete test contractors
-- production_orders and material_transfers will be deleted automatically (CASCADE)
DELETE FROM contractors
WHERE id LIKE 'cnt-%' 
   OR id LIKE 'supplier-%'
   OR id IN ('cnt-001', 'cnt-002', 'supplier-001', 'supplier-002', 'supplier-003');

-- Step 5: Verify deletion
SELECT COUNT(*) as remaining_contractors FROM contractors;

-- Step 6: Show remaining contractors
SELECT id, name, code, contact_person, phone, email 
FROM contractors 
ORDER BY name;

