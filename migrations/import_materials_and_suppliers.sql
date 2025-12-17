-- Migration: Import Materials and Suppliers
-- Description: Template for bulk import of materials (items) and suppliers (contractors)
-- Instructions:
--   1. Replace the example data below with your actual materials and suppliers
--   2. Execute this script in Supabase SQL Editor: https://supabase.com/dashboard/project/nhsnxypdprellsmouhlp/sql/new
--   3. Materials will appear immediately in the "Материалы" (Materials) page
--   4. Suppliers will appear in the "Поставщики" (Suppliers) page

-- ============================================
-- PART 1: INSERT SUPPLIERS (CONTRACTORS)
-- ============================================
-- Replace the examples below with your actual suppliers
-- Format: (id, name, code, contact_person, phone, email)
-- Note: 'id' should be unique (e.g., 'supplier-001', 'supplier-002', etc.)
--       'code' should be unique (will be auto-generated if not provided)

INSERT INTO contractors (id, name, code, contact_person, phone, email)
VALUES
    -- Example supplier 1 - Replace with your data
    ('supplier-001', 'Название поставщика 1', 'SUP-001', 'Иван Иванов', '+380501234567', 'supplier1@example.com'),
    -- Example supplier 2 - Replace with your data
    ('supplier-002', 'Название поставщика 2', 'SUP-002', 'Петр Петров', '+380507654321', 'supplier2@example.com')
    -- Add more suppliers here (don't forget comma before last one):
    -- ('supplier-003', 'Название поставщика 3', 'SUP-003', NULL, NULL, NULL)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    code = EXCLUDED.code,
    contact_person = EXCLUDED.contact_person,
    phone = EXCLUDED.phone,
    email = EXCLUDED.email,
    updated_at = NOW();

-- ============================================
-- PART 2: INSERT MATERIALS (ITEMS)
-- ============================================
-- Replace the examples below with your actual materials
-- Format: (id, sku, name, category, unit, min_stock_level)
-- 
-- Categories available:
--   - 'tea_bulk' - Чай сыпучий
--   - 'flavor' - Ароматизаторы
--   - 'packaging_consumable' - Упаковка расходная
--   - 'packaging_box' - Упаковка коробки
--   - 'packaging_crate' - Упаковка ящики
--   - 'label' - Этикетки
--   - 'other' - Прочее
--
-- Units available:
--   - 'kg' - Килограммы
--   - 'pcs' - Штуки
--   - 'l' - Литры
--   - 'm' - Метры

INSERT INTO items (id, sku, name, category, unit, min_stock_level)
VALUES
    -- Example material 1 - Replace with your data
    -- Use 'Артикул' as 'id' and 'sku', 'Назва' as 'name'
    ('ART-001', 'ART-001', 'Название материала 1', 'tea_bulk', 'kg', 100),
    -- Example material 2 - Replace with your data
    ('ART-002', 'ART-002', 'Название материала 2', 'flavor', 'kg', 50)
    -- Add more materials here (don't forget comma before last one):
    -- ('ART-003', 'ART-003', 'Название материала 3', 'packaging_consumable', 'pcs', 1000)
ON CONFLICT (id) DO UPDATE SET
    sku = EXCLUDED.sku,
    name = EXCLUDED.name,
    category = EXCLUDED.category,
    unit = EXCLUDED.unit,
    min_stock_level = EXCLUDED.min_stock_level;

-- ============================================
-- PART 3: OPTIONAL - SET INITIAL STOCK LEVELS
-- ============================================
-- If you want to set initial stock levels for materials
-- Replace warehouse_id with actual warehouse IDs:
--   - 'wh-main' - Главный склад
--   - 'wh-prod-1' - Цех (IMA C23 #1)
--   - 'wh-prod-2' - Цех (IMA C23 #2)
--   - 'wh-contractor' - Склад Подрядчика

-- INSERT INTO stock_levels (item_id, warehouse_id, quantity)
-- VALUES
--     ('ART-001', 'wh-main', 500),
--     ('ART-001', 'wh-prod-1', 50),
--     ('ART-002', 'wh-main', 200),
--     -- Add more stock levels...
-- ON CONFLICT (item_id, warehouse_id) DO UPDATE SET
--     quantity = EXCLUDED.quantity;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================
-- Run these queries to verify the import:

-- Check imported suppliers
SELECT id, name, code, contact_person, phone, email 
FROM contractors 
ORDER BY name;

-- Check imported materials
SELECT id, sku, name, category, unit, min_stock_level 
FROM items 
ORDER BY name;

-- Count total items
SELECT COUNT(*) as total_items FROM items;

-- Count total suppliers
SELECT COUNT(*) as total_suppliers FROM contractors;

