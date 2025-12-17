-- Migration: Delete Old Warehouses
-- Description: Remove old warehouses (wh-main, wh-prod-1, wh-prod-2, wh-contractor) after migration to new structure
-- WARNING: This will delete old warehouses and their stock levels. Use with caution!

-- Step 1: Show what will be deleted (for verification)
SELECT 
    w.id,
    w.name,
    COUNT(sl.id) as stock_levels_count,
    SUM(sl.quantity) as total_quantity
FROM warehouses w
LEFT JOIN stock_levels sl ON w.id = sl.warehouse_id
WHERE w.id IN ('wh-main', 'wh-prod-1', 'wh-prod-2', 'wh-contractor')
GROUP BY w.id, w.name
ORDER BY w.name;

-- Step 2: Delete stock levels for old warehouses
-- This must be done first due to foreign key constraints
DELETE FROM stock_levels 
WHERE warehouse_id IN ('wh-main', 'wh-prod-1', 'wh-prod-2', 'wh-contractor');

-- Step 3: Delete old warehouses
DELETE FROM warehouses 
WHERE id IN ('wh-main', 'wh-prod-1', 'wh-prod-2', 'wh-contractor');

-- Step 4: Verify deletion
SELECT 
    id,
    name,
    location,
    type
FROM warehouses
ORDER BY name;

-- Step 5: Show remaining warehouses count
SELECT COUNT(*) as remaining_warehouses FROM warehouses;

