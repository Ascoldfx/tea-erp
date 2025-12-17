-- Migration: Separate Suppliers and Contractors
-- Description: 
-- 1. Create suppliers table
-- 2. Move existing suppliers from contractors table to suppliers table
-- 3. Keep only packaging contractors (Фито, ТС) in contractors table
-- 4. Update orders table to reference suppliers instead of contractors

-- Step 1: Create suppliers table (if not exists)
CREATE TABLE IF NOT EXISTS suppliers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT UNIQUE,
    contact_person TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 2: Create indexes for suppliers
CREATE INDEX IF NOT EXISTS idx_suppliers_name ON suppliers(name);
CREATE INDEX IF NOT EXISTS idx_suppliers_code ON suppliers(code);
CREATE INDEX IF NOT EXISTS idx_suppliers_email ON suppliers(email);

-- Step 3: Create function and trigger for suppliers updated_at
CREATE OR REPLACE FUNCTION update_suppliers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS suppliers_updated_at ON suppliers;
CREATE TRIGGER suppliers_updated_at
    BEFORE UPDATE ON suppliers
    FOR EACH ROW
    EXECUTE FUNCTION update_suppliers_updated_at();

-- Step 4: Set up RLS for suppliers
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view suppliers" ON suppliers;
DROP POLICY IF EXISTS "Authenticated users can create suppliers" ON suppliers;
DROP POLICY IF EXISTS "Authenticated users can update suppliers" ON suppliers;
DROP POLICY IF EXISTS "Authenticated users can delete suppliers" ON suppliers;

CREATE POLICY "Authenticated users can view suppliers"
    ON suppliers FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can create suppliers"
    ON suppliers FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Authenticated users can update suppliers"
    ON suppliers FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Authenticated users can delete suppliers"
    ON suppliers FOR DELETE
    TO authenticated
    USING (true);

-- Step 5: Move all contractors to suppliers (except Фито and ТС)
-- These will be suppliers (those who supply goods/materials)
INSERT INTO suppliers (id, name, code, contact_person, phone, email, address, created_at, updated_at)
SELECT id, name, code, contact_person, phone, email, address, created_at, updated_at
FROM contractors
WHERE id NOT IN ('wh-fito', 'wh-ts')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    code = EXCLUDED.code,
    contact_person = EXCLUDED.contact_person,
    phone = EXCLUDED.phone,
    email = EXCLUDED.email,
    address = EXCLUDED.address,
    updated_at = EXCLUDED.updated_at;

-- Step 6: Update orders table to use supplier_id instead of contractor_id
-- Note: Orders are for materials from suppliers, not contractors
DO $$
BEGIN
    -- Check if orders table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'orders') THEN
        -- Add supplier_id column if it doesn't exist
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'orders' AND column_name = 'supplier_id'
        ) THEN
            ALTER TABLE orders ADD COLUMN supplier_id TEXT;
            
            -- Copy contractor_id to supplier_id for existing orders (if contractor_id exists)
            IF EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'orders' AND column_name = 'contractor_id'
            ) THEN
                UPDATE orders 
                SET supplier_id = contractor_id 
                WHERE contractor_id IS NOT NULL;
            END IF;
            
            -- Add foreign key constraint
            ALTER TABLE orders 
            ADD CONSTRAINT fk_orders_supplier 
            FOREIGN KEY (supplier_id) REFERENCES suppliers(id);
            
            -- Create index
            CREATE INDEX IF NOT EXISTS idx_orders_supplier ON orders(supplier_id);
        END IF;
    END IF;
END $$;

-- Step 7: Clean up contractors table - keep only Фито and ТС
-- Delete all contractors except Фито and ТС
DELETE FROM contractors WHERE id NOT IN ('wh-fito', 'wh-ts');

-- Step 8: Ensure Фито and ТС exist in contractors table
INSERT INTO contractors (id, name, code, contact_person, phone, email)
VALUES
    ('wh-fito', 'Фито', 'FITO', NULL, NULL, NULL),
    ('wh-ts', 'ТС', 'TS', NULL, NULL, NULL)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    code = EXCLUDED.code,
    contact_person = EXCLUDED.contact_person,
    phone = EXCLUDED.phone,
    email = EXCLUDED.email;

-- Step 9: Update comments
COMMENT ON TABLE suppliers IS 'Поставщики товаров и материалов';
COMMENT ON TABLE contractors IS 'Подрядчики по фасовке чая (Фито, ТС)';

-- Step 10: Verify
SELECT 'Suppliers:' as table_name, COUNT(*) as count FROM suppliers
UNION ALL
SELECT 'Contractors:', COUNT(*) FROM contractors;

