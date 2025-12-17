-- Migration: Clear All Materials
-- Description: Remove all materials (items) and related data for fresh import
-- WARNING: This will delete ALL materials and related data. Use with caution!

-- Step 1: Show counts before deletion
SELECT COUNT(*) as items_before FROM items;
SELECT COUNT(*) as stock_levels_before FROM stock_levels;
SELECT COUNT(*) as order_items_before FROM order_items;

-- Step 2: Delete order items that reference items
DELETE FROM order_items
WHERE item_id IN (SELECT id FROM items);

-- Step 3: Delete stock movements
DELETE FROM stock_movements;

-- Step 4: Delete stock levels (foreign key constraint)
DELETE FROM stock_levels;

-- Step 5: Delete production orders that reference items (if table exists)
DO $$
BEGIN
    DELETE FROM production_orders WHERE item_id IN (SELECT id FROM items);
EXCEPTION
    WHEN undefined_table THEN
        NULL;
END $$;

-- Step 6: Delete material transfers that reference items (if table exists)
DO $$
BEGIN
    DELETE FROM material_transfers WHERE item_id IN (SELECT id FROM items);
EXCEPTION
    WHEN undefined_table THEN
        NULL;
END $$;

-- Step 7: Finally, delete all items
DELETE FROM items;

-- Step 8: Verify deletion
SELECT COUNT(*) as items_after FROM items;
SELECT COUNT(*) as stock_levels_after FROM stock_levels;
SELECT COUNT(*) as order_items_after FROM order_items;

-- Step 9: Success message
SELECT 'All materials have been cleared successfully! Ready for fresh import.' as message;

