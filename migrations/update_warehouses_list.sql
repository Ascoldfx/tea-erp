-- Migration: Update Warehouses List
-- Description: Replace existing warehouses with: Коцюбинське, Цех, ТС, Фито

-- Delete old warehouses (optional - comment out if you want to keep existing data)
-- DELETE FROM stock_levels WHERE warehouse_id IN ('wh-main', 'wh-prod-1', 'wh-prod-2', 'wh-contractor');
-- DELETE FROM warehouses WHERE id IN ('wh-main', 'wh-prod-1', 'wh-prod-2', 'wh-contractor');

-- Insert or update new warehouses
-- Note: description column may not exist in warehouses table, so we don't include it
INSERT INTO warehouses (id, name, location, type)
VALUES
    ('wh-kotsyubinske', 'Коцюбинське', 'Коцюбинське', 'internal'),
    ('wh-ceh', 'Цех', 'Цех', 'internal'),
    ('wh-ts', 'ТС', 'ТС', 'internal'),
    ('wh-fito', 'Фито', 'Фито', 'internal')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    location = EXCLUDED.location,
    type = EXCLUDED.type;

-- Comments
COMMENT ON TABLE warehouses IS 'Склады: Коцюбинське, Цех, ТС, Фито';
