-- Migration: Add Cardboard Packaging Category with Materials, Stock, and Planned Consumption
-- Description: Add materials for cardboard packaging category with stock levels and planned consumption

-- Step 1: Insert cardboard packaging materials
-- Note: Using 'packaging_cardboard' as category (will be normalized from Excel imports)
INSERT INTO items (id, sku, name, category, unit, min_stock_level)
VALUES
    -- Коробки разных размеров
    ('cardboard-box-150x41x61', '2010247', 'Коробка для чаю 150x41x61мм', 'packaging_cardboard', 'pcs', 1000),
    ('cardboard-box-200x50x80', '2010248', 'Коробка для чаю 200x50x80мм', 'packaging_cardboard', 'pcs', 500),
    ('cardboard-box-250x60x100', '2010249', 'Коробка для чаю 250x60x100мм', 'packaging_cardboard', 'pcs', 300),
    
    -- Пачки
    ('cardboard-pack-100g', '2010250', 'Пачка картонная 100г', 'packaging_cardboard', 'pcs', 2000),
    ('cardboard-pack-200g', '2010251', 'Пачка картонная 200г', 'packaging_cardboard', 'pcs', 1500),
    ('cardboard-pack-500g', '2010252', 'Пачка картонная 500г', 'packaging_cardboard', 'pcs', 800),
    
    -- Гофрокартон
    ('cardboard-corrugated-sheet', '2010253', 'Лист гофрокартона А4', 'packaging_cardboard', 'pcs', 5000),
    ('cardboard-corrugated-box', '2010254', 'Коробка из гофрокартона универсальная', 'packaging_cardboard', 'pcs', 1000)
ON CONFLICT (id) DO UPDATE SET
    sku = EXCLUDED.sku,
    name = EXCLUDED.name,
    category = EXCLUDED.category,
    unit = EXCLUDED.unit,
    min_stock_level = EXCLUDED.min_stock_level;

-- Step 2: Add stock levels for these materials
-- Get warehouse IDs (assuming they exist)
-- Main warehouse (Коцюбинське)
INSERT INTO stock_levels (item_id, warehouse_id, quantity)
VALUES
    ('cardboard-box-150x41x61', 'wh-kotsyubinske', 5000),
    ('cardboard-box-200x50x80', 'wh-kotsyubinske', 3000),
    ('cardboard-box-250x60x100', 'wh-kotsyubinske', 2000),
    ('cardboard-pack-100g', 'wh-kotsyubinske', 10000),
    ('cardboard-pack-200g', 'wh-kotsyubinske', 8000),
    ('cardboard-pack-500g', 'wh-kotsyubinske', 5000),
    ('cardboard-corrugated-sheet', 'wh-kotsyubinske', 20000),
    ('cardboard-corrugated-box', 'wh-kotsyubinske', 3000)
ON CONFLICT (item_id, warehouse_id) DO UPDATE SET
    quantity = EXCLUDED.quantity;

-- Production warehouse (Цех)
INSERT INTO stock_levels (item_id, warehouse_id, quantity)
VALUES
    ('cardboard-box-150x41x61', 'wh-ceh', 1000),
    ('cardboard-box-200x50x80', 'wh-ceh', 500),
    ('cardboard-box-250x60x100', 'wh-ceh', 300),
    ('cardboard-pack-100g', 'wh-ceh', 2000),
    ('cardboard-pack-200g', 'wh-ceh', 1500),
    ('cardboard-pack-500g', 'wh-ceh', 1000),
    ('cardboard-corrugated-sheet', 'wh-ceh', 5000),
    ('cardboard-corrugated-box', 'wh-ceh', 500)
ON CONFLICT (item_id, warehouse_id) DO UPDATE SET
    quantity = EXCLUDED.quantity;

-- Step 3: Add planned consumption for these materials
-- Planned consumption for December 2025
INSERT INTO planned_consumption (item_id, planned_date, quantity, notes)
VALUES
    ('cardboard-box-150x41x61', '2025-12-01', 2000, 'План производства на декабрь'),
    ('cardboard-box-200x50x80', '2025-12-01', 1000, 'План производства на декабрь'),
    ('cardboard-box-250x60x100', '2025-12-01', 500, 'План производства на декабрь'),
    ('cardboard-pack-100g', '2025-12-01', 5000, 'План производства на декабрь'),
    ('cardboard-pack-200g', '2025-12-01', 3000, 'План производства на декабрь'),
    ('cardboard-pack-500g', '2025-12-01', 2000, 'План производства на декабрь'),
    ('cardboard-corrugated-sheet', '2025-12-01', 10000, 'План производства на декабрь'),
    ('cardboard-corrugated-box', '2025-12-01', 1500, 'План производства на декабрь')
ON CONFLICT (item_id, planned_date) DO UPDATE SET
    quantity = EXCLUDED.quantity,
    notes = EXCLUDED.notes;

-- Step 4: Verify the data
SELECT 
    i.sku,
    i.name,
    i.category,
    i.unit,
    SUM(sl.quantity) as total_stock,
    COUNT(DISTINCT sl.warehouse_id) as warehouse_count
FROM items i
LEFT JOIN stock_levels sl ON i.id = sl.item_id
WHERE i.category = 'packaging_cardboard'
GROUP BY i.id, i.sku, i.name, i.category, i.unit
ORDER BY i.name;

-- Step 5: Show planned consumption
SELECT 
    i.sku,
    i.name,
    pc.planned_date,
    pc.quantity as planned_quantity,
    pc.notes
FROM planned_consumption pc
JOIN items i ON pc.item_id = i.id
WHERE i.category = 'packaging_cardboard'
ORDER BY i.name, pc.planned_date;

