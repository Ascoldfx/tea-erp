-- Migration: Delete All Orders
-- Description: Remove all orders and related data (order_items)
-- WARNING: This will delete ALL orders. Use with caution!

-- Step 1: Show count of orders before deletion
SELECT COUNT(*) as total_orders FROM orders;
SELECT COUNT(*) as total_order_items FROM order_items;

-- Step 2: Delete all order items first (foreign key constraint)
DELETE FROM order_items;

-- Step 3: Delete all orders
DELETE FROM orders;

-- Step 4: Verify deletion
SELECT COUNT(*) as remaining_orders FROM orders;
SELECT COUNT(*) as remaining_order_items FROM order_items;

-- Step 5: Show message
SELECT 'All orders and order items have been deleted successfully!' as message;


