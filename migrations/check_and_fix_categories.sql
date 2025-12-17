-- Migration: Check and Fix Material Categories
-- Description: Verify that materials have correct categories, especially flavors and stickers
-- This helps debug why some materials don't appear in category filters

-- Step 1: Show category distribution
SELECT 
    category,
    COUNT(*) as count
FROM items
GROUP BY category
ORDER BY count DESC;

-- Step 2: Show all flavor items (if any)
SELECT 
    id,
    sku,
    name,
    category
FROM items
WHERE category = 'flavor'
ORDER BY name;

-- Step 3: Show all sticker items (if any)
SELECT 
    id,
    sku,
    name,
    category
FROM items
WHERE category = 'sticker'
ORDER BY name;

-- Step 4: Show items that might be flavors but are in wrong category
-- (items with "ароматизатор" in name but not in flavor category)
SELECT 
    id,
    sku,
    name,
    category
FROM items
WHERE LOWER(name) LIKE '%ароматизатор%'
  AND category != 'flavor'
ORDER BY name;

-- Step 5: Show items that might be stickers but are in wrong category
-- (items with "стикер", "этикетка", "етикетка" in name but not in sticker category)
SELECT 
    id,
    sku,
    name,
    category
FROM items
WHERE (LOWER(name) LIKE '%стикер%' 
    OR LOWER(name) LIKE '%этикетка%' 
    OR LOWER(name) LIKE '%етикетка%')
  AND category != 'sticker'
ORDER BY name;

-- Step 6: If you want to manually fix categories, uncomment and modify:
-- UPDATE items SET category = 'flavor' WHERE LOWER(name) LIKE '%ароматизатор%' AND category != 'flavor';
-- UPDATE items SET category = 'sticker' WHERE (LOWER(name) LIKE '%стикер%' OR LOWER(name) LIKE '%этикетка%' OR LOWER(name) LIKE '%етикетка%') AND category != 'sticker';

