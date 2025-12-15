-- Migration: Add Production Orders and Material Transfers for Contractors
-- Description: Tables to track packaging orders sent to contractors and materials transferred to them

-- Table: production_orders
-- Заказы на фасовку чая, переданные подрядчикам
CREATE TABLE IF NOT EXISTS production_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contractor_id UUID NOT NULL REFERENCES contractors(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    quantity DECIMAL(10, 2) NOT NULL CHECK (quantity > 0),
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
    deadline DATE,
    completed_quantity DECIMAL(10, 2) DEFAULT 0 CHECK (completed_quantity >= 0),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- Table: material_transfers
-- Передача материалов подрядчикам для выполнения заказов
CREATE TABLE IF NOT EXISTS material_transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    production_order_id UUID REFERENCES production_orders(id) ON DELETE CASCADE,
    contractor_id UUID NOT NULL REFERENCES contractors(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    from_warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    quantity DECIMAL(10, 2) NOT NULL CHECK (quantity > 0),
    transfer_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    returned_quantity DECIMAL(10, 2) DEFAULT 0 CHECK (returned_quantity >= 0),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_production_orders_contractor ON production_orders(contractor_id);
CREATE INDEX IF NOT EXISTS idx_production_orders_status ON production_orders(status);
CREATE INDEX IF NOT EXISTS idx_production_orders_created ON production_orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_material_transfers_contractor ON material_transfers(contractor_id);
CREATE INDEX IF NOT EXISTS idx_material_transfers_order ON material_transfers(production_order_id);
CREATE INDEX IF NOT EXISTS idx_material_transfers_date ON material_transfers(transfer_date DESC);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_production_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
        NEW.completed_at = NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER production_orders_updated_at
    BEFORE UPDATE ON production_orders
    FOR EACH ROW
    EXECUTE FUNCTION update_production_orders_updated_at();

-- RLS Policies for production_orders
ALTER TABLE production_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all authenticated users to view production orders"
    ON production_orders FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow admins and procurement to manage production orders"
    ON production_orders FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role IN ('admin', 'procurement', 'warehouse')
        )
    );

-- RLS Policies for material_transfers
ALTER TABLE material_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all authenticated users to view material transfers"
    ON material_transfers FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow admins and warehouse to manage material transfers"
    ON material_transfers FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role IN ('admin', 'warehouse', 'procurement')
        )
    );

-- Comments for documentation
COMMENT ON TABLE production_orders IS 'Заказы на фасовку чая, переданные подрядчикам';
COMMENT ON TABLE material_transfers IS 'Передача материалов подрядчикам для выполнения заказов';
COMMENT ON COLUMN production_orders.status IS 'pending - ожидает, in_progress - в работе, completed - завершено, cancelled - отменено';
COMMENT ON COLUMN production_orders.completed_quantity IS 'Фактически выполненное количество';
COMMENT ON COLUMN material_transfers.returned_quantity IS 'Возвращенное количество материалов';
