-- Migration: Update Warehouses List
-- Description: Replace existing warehouses with: Коцюбинське, Цех, ТС, Фито

-- Delete old warehouses (optional - uncomment if you want to delete old warehouses)
-- IMPORTANT: First delete stock_levels, then warehouses (due to foreign key constraints)
-- DELETE FROM stock_levels WHERE warehouse_id IN ('wh-main', 'wh-prod-1', 'wh-prod-2', 'wh-contractor');
-- DELETE FROM warehouses WHERE id IN ('wh-main', 'wh-prod-1', 'wh-prod-2', 'wh-contractor');
-- 
-- Or use the separate migration file: migrations/delete_old_warehouses.sql

-- Insert or update new warehouses
-- Note: description column may not exist in warehouses table, so we don't include it
INSERT INTO warehouses (id, name, location, type)
VALUES
    ('wh-kotsyubinske', 'Коцюбинське', 'Коцюбинське', 'internal'),
    ('wh-ceh', 'Цех', 'Цех', 'internal'),
    ('wh-ts', 'ТС', 'ТС', 'internal'),  -- ТС (подрядчик по фасовке)
    ('wh-fito', 'Фито', 'Фито', 'internal')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    location = EXCLUDED.location,
    type = EXCLUDED.type;

-- Comments
COMMENT ON TABLE warehouses IS 'Склады: Коцюбинське, Цех, ТС, Фито';
