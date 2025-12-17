-- Migration: Reset All Material Categories
-- Description: Set all material categories to NULL or empty to test dynamic category assignment
-- WARNING: This will reset all category assignments. Categories will be reassigned on next Excel import.

-- Step 1: Show current category distribution
SELECT 
    category,
    COUNT(*) as count
FROM items
GROUP BY category
ORDER BY count DESC;

-- Step 2: Reset all categories to NULL (they will be reassigned on import)
UPDATE items 
SET category = NULL
WHERE category IS NOT NULL;

-- Alternative: Set all to 'other' if you prefer
-- UPDATE items SET category = 'other';

-- Step 3: Verify reset
SELECT 
    category,
    COUNT(*) as count
FROM items
GROUP BY category
ORDER BY count DESC;

-- Step 4: Show sample items
SELECT 
    id,
    sku,
    name,
    category
FROM items
LIMIT 10;

