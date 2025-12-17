-- Migration: Create Suppliers Table
-- Description: Create separate table for suppliers (those who supply goods and materials)
-- This separates suppliers from contractors (who provide packaging services)

-- Table: suppliers
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

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_suppliers_name ON suppliers(name);
CREATE INDEX IF NOT EXISTS idx_suppliers_code ON suppliers(code);
CREATE INDEX IF NOT EXISTS idx_suppliers_email ON suppliers(email);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_suppliers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS suppliers_updated_at ON suppliers;
CREATE TRIGGER suppliers_updated_at
    BEFORE UPDATE ON suppliers
    FOR EACH ROW
    EXECUTE FUNCTION update_suppliers_updated_at();

-- RLS Policies for suppliers
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Authenticated users can view suppliers" ON suppliers;
DROP POLICY IF EXISTS "Authenticated users can create suppliers" ON suppliers;
DROP POLICY IF EXISTS "Authenticated users can update suppliers" ON suppliers;
DROP POLICY IF EXISTS "Authenticated users can delete suppliers" ON suppliers;

-- Allow authenticated users to view suppliers
CREATE POLICY "Authenticated users can view suppliers"
    ON suppliers FOR SELECT
    TO authenticated
    USING (true);

-- Allow authenticated users to insert suppliers
CREATE POLICY "Authenticated users can create suppliers"
    ON suppliers FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Allow authenticated users to update suppliers
CREATE POLICY "Authenticated users can update suppliers"
    ON suppliers FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Allow authenticated users to delete suppliers
CREATE POLICY "Authenticated users can delete suppliers"
    ON suppliers FOR DELETE
    TO authenticated
    USING (true);

-- Comments
COMMENT ON TABLE suppliers IS 'Поставщики товаров и материалов';
COMMENT ON COLUMN suppliers.code IS 'Уникальный код поставщика';

