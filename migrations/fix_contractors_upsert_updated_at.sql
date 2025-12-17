-- Migration: Fix contractors updated_at for UPSERT operations
-- Description: Ensure updated_at is properly handled during UPSERT (INSERT ... ON CONFLICT DO UPDATE)
-- This fixes the error: "record 'new' has no field 'updated_at'"

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS contractors_updated_at ON contractors;

-- Create improved function that handles INSERT, UPDATE, and UPSERT properly
CREATE OR REPLACE FUNCTION update_contractors_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    -- For INSERT: set updated_at if not already set
    IF TG_OP = 'INSERT' THEN
        IF NEW.updated_at IS NULL THEN
            NEW.updated_at = NOW();
        END IF;
        RETURN NEW;
    END IF;
    
    -- For UPDATE: always update updated_at
    IF TG_OP = 'UPDATE' THEN
        NEW.updated_at = NOW();
        RETURN NEW;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for both INSERT and UPDATE
-- This trigger will fire for both INSERT and UPDATE operations, including those from UPSERT
CREATE TRIGGER contractors_updated_at
    BEFORE INSERT OR UPDATE ON contractors
    FOR EACH ROW
    EXECUTE FUNCTION update_contractors_updated_at();

-- Ensure the table has a default value for updated_at
ALTER TABLE contractors 
    ALTER COLUMN updated_at SET DEFAULT NOW();

-- Comments
COMMENT ON FUNCTION update_contractors_updated_at() IS 'Автоматически устанавливает updated_at при INSERT, UPDATE и UPSERT для таблицы contractors';
COMMENT ON TRIGGER contractors_updated_at ON contractors IS 'Триггер для автоматического обновления updated_at';

