-- Migration: Add Supplier Stock Locations and Planned Consumption
-- Description: Extend warehouses to support supplier locations and add planned consumption tracking

-- Step 1: Add type and contractor_id to warehouses table
DO $$ 
BEGIN
    -- Add type column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'warehouses' AND column_name = 'type'
    ) THEN
        ALTER TABLE warehouses ADD COLUMN type TEXT DEFAULT 'internal' CHECK (type IN ('internal', 'supplier', 'contractor'));
    END IF;
    
    -- Add contractor_id column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'warehouses' AND column_name = 'contractor_id'
    ) THEN
        ALTER TABLE warehouses ADD COLUMN contractor_id TEXT REFERENCES contractors(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Update existing warehouses to be 'internal' type
UPDATE warehouses SET type = 'internal' WHERE type IS NULL;

-- Add comment
COMMENT ON COLUMN warehouses.type IS 'Тип локации: internal - наш склад, supplier - у поставщика, contractor - у подрядчика';
COMMENT ON COLUMN warehouses.contractor_id IS 'ID поставщика/подрядчика (если type = supplier или contractor)';

-- Step 2: Create planned_consumption table for tracking planned material consumption
CREATE TABLE IF NOT EXISTS planned_consumption (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    planned_date DATE NOT NULL,
    quantity DECIMAL(10, 2) NOT NULL CHECK (quantity >= 0),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    
    -- Ensure one planned consumption per item per date
    UNIQUE(item_id, planned_date)
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_planned_consumption_item ON planned_consumption(item_id);
CREATE INDEX IF NOT EXISTS idx_planned_consumption_date ON planned_consumption(planned_date);
CREATE INDEX IF NOT EXISTS idx_planned_consumption_item_date ON planned_consumption(item_id, planned_date);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_planned_consumption_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS planned_consumption_updated_at ON planned_consumption;
CREATE TRIGGER planned_consumption_updated_at
    BEFORE UPDATE ON planned_consumption
    FOR EACH ROW
    EXECUTE FUNCTION update_planned_consumption_updated_at();

-- RLS Policies for planned_consumption
ALTER TABLE planned_consumption ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Authenticated users can view planned consumption" ON planned_consumption;
DROP POLICY IF EXISTS "Authenticated users can manage planned consumption" ON planned_consumption;

-- Allow authenticated users to view planned consumption
CREATE POLICY "Authenticated users can view planned consumption"
    ON planned_consumption FOR SELECT
    TO authenticated
    USING (true);

-- Allow authenticated users to insert/update/delete planned consumption
CREATE POLICY "Authenticated users can manage planned consumption"
    ON planned_consumption FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Comments
COMMENT ON TABLE planned_consumption IS 'Плановые расходы материалов по датам';
COMMENT ON COLUMN planned_consumption.item_id IS 'ID материала';
COMMENT ON COLUMN planned_consumption.planned_date IS 'Дата планируемого расхода';
COMMENT ON COLUMN planned_consumption.quantity IS 'Планируемое количество к расходу';

-- Step 3: Update warehouses table RLS if needed (should already exist, but ensure it)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'warehouses' AND policyname = 'Authenticated users can view warehouses'
    ) THEN
        ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;
        CREATE POLICY "Authenticated users can view warehouses"
            ON warehouses FOR SELECT
            TO authenticated
            USING (true);
    END IF;
END $$;

