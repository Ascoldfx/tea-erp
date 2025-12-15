-- Add received_quantity column to order_items table
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS received_quantity NUMERIC DEFAULT 0;

-- Update existing rows to set received_quantity = quantity for delivered orders
UPDATE order_items 
SET received_quantity = quantity 
WHERE order_id IN (
    SELECT id FROM orders WHERE status = 'delivered'
);
