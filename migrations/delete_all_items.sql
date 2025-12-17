-- Migration: Delete All Items (Materials)
-- Description: Remove all materials (items) and related data (stock levels, order items, stock movements)
-- WARNING: This will delete ALL materials and related data. Use with caution!

-- Step 1: Show count of items before deletion
SELECT COUNT(*) as total_items FROM items;
SELECT COUNT(*) as total_stock_levels FROM stock_levels;
SELECT COUNT(*) as total_stock_movements FROM stock_movements;

-- Step 2: Delete order items that reference items (if any remain)
DELETE FROM order_items
WHERE item_id IN (SELECT id FROM items);

-- Step 3: Delete stock movements
DELETE FROM stock_movements;

-- Step 4: Delete stock levels (foreign key constraint)
DELETE FROM stock_levels;

-- Step 5: Delete production orders that reference items (if any)
-- Note: This might fail if production_orders table doesn't exist, that's okay
DO $$
BEGIN
    DELETE FROM production_orders WHERE item_id IN (SELECT id FROM items);
EXCEPTION
    WHEN undefined_table THEN
        -- Table doesn't exist, skip
        NULL;
END $$;

-- Step 6: Delete material transfers that reference items (if any)
DO $$
BEGIN
    DELETE FROM material_transfers WHERE item_id IN (SELECT id FROM items);
EXCEPTION
    WHEN undefined_table THEN
        -- Table doesn't exist, skip
        NULL;
END $$;

-- Step 7: Finally, delete all items
DELETE FROM items;

-- Step 8: Verify deletion
SELECT COUNT(*) as remaining_items FROM items;
SELECT COUNT(*) as remaining_stock_levels FROM stock_levels;
SELECT COUNT(*) as remaining_stock_movements FROM stock_movements;

-- Step 9: Show message
SELECT 'All materials and related data have been deleted successfully!' as message;

