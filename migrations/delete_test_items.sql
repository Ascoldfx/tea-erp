-- Migration: Delete Test Items
-- Description: Remove all test/mock materials from items table
-- WARNING: This will delete ALL items. Use with caution!

-- Delete stock levels first (foreign key constraint)
DELETE FROM stock_levels;

-- Delete order items that reference items
DELETE FROM order_items;

-- Delete stock movements
DELETE FROM stock_movements;

-- Finally, delete all items
DELETE FROM items;

-- Optional: Reset sequence if using auto-increment IDs
-- (Not needed if using TEXT IDs)

-- Verify deletion
SELECT COUNT(*) as remaining_items FROM items;

