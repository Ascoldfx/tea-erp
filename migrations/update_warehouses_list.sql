-- Migration: Update Warehouses List
-- Description: Replace existing warehouses with: Коцюбинське, Цех, ТС, Фито

-- Delete old warehouses (optional - comment out if you want to keep existing data)
-- DELETE FROM stock_levels WHERE warehouse_id IN ('wh-main', 'wh-prod-1', 'wh-prod-2', 'wh-contractor');
-- DELETE FROM warehouses WHERE id IN ('wh-main', 'wh-prod-1', 'wh-prod-2', 'wh-contractor');

-- Insert or update new warehouses
INSERT INTO warehouses (id, name, location, description, type)
VALUES
    ('wh-kotsyubinske', 'Коцюбинське', 'Коцюбинське', 'Склад в Коцюбинське', 'internal'),
    ('wh-ceh', 'Цех', 'Цех', 'Производственный цех', 'internal'),
    ('wh-ts', 'ТС', 'ТС', 'Торговый склад', 'internal'),
    ('wh-fito', 'Фито', 'Фито', 'Склад Фито', 'internal')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    location = EXCLUDED.location,
    description = EXCLUDED.description,
    type = EXCLUDED.type;

-- Comments
COMMENT ON TABLE warehouses IS 'Склады: Коцюбинське, Цех, ТС, Фито';

