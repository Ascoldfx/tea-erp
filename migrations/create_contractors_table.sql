-- Migration: Create Contractors Table
-- Description: Create contractors table for suppliers and packaging contractors

-- Table: contractors
CREATE TABLE IF NOT EXISTS contractors (
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
CREATE INDEX IF NOT EXISTS idx_contractors_name ON contractors(name);
CREATE INDEX IF NOT EXISTS idx_contractors_code ON contractors(code);
CREATE INDEX IF NOT EXISTS idx_contractors_email ON contractors(email);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_contractors_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS contractors_updated_at ON contractors;
CREATE TRIGGER contractors_updated_at
    BEFORE UPDATE ON contractors
    FOR EACH ROW
    EXECUTE FUNCTION update_contractors_updated_at();

-- RLS Policies for contractors
ALTER TABLE contractors ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Authenticated users can view contractors" ON contractors;
DROP POLICY IF EXISTS "Authenticated users can create contractors" ON contractors;
DROP POLICY IF EXISTS "Authenticated users can update contractors" ON contractors;
DROP POLICY IF EXISTS "Authenticated users can delete contractors" ON contractors;

-- Allow authenticated users to view contractors
CREATE POLICY "Authenticated users can view contractors"
    ON contractors FOR SELECT
    TO authenticated
    USING (true);

-- Allow authenticated users to insert contractors (can be restricted to admins/procurement later)
CREATE POLICY "Authenticated users can create contractors"
    ON contractors FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Allow authenticated users to update contractors
CREATE POLICY "Authenticated users can update contractors"
    ON contractors FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Allow authenticated users to delete contractors
CREATE POLICY "Authenticated users can delete contractors"
    ON contractors FOR DELETE
    TO authenticated
    USING (true);

-- Comments
COMMENT ON TABLE contractors IS 'Поставщики и подрядчики (фасовка, упаковка)';
COMMENT ON COLUMN contractors.code IS 'Уникальный код поставщика (автогенерируется из названия)';

