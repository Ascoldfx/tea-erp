-- Migration: Merge packaging_box category into packaging_cardboard
-- Since packaging_box and packaging_cardboard are the same thing (cardboard packaging for tea),
-- we merge all packaging_box items into packaging_cardboard

-- Update all items with packaging_box category to packaging_cardboard
UPDATE items
SET category = 'packaging_cardboard'
WHERE category = 'packaging_box';

-- Verify the update
-- SELECT COUNT(*) as packaging_box_count FROM items WHERE category = 'packaging_box';
-- Should return 0 after migration

