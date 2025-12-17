-- Migration: Fix contractors updated_at for UPSERT operations
-- Description: Add updated_at column if missing, then ensure it's properly handled during UPSERT
-- This fixes the error: "record 'new' has no field 'updated_at'"

-- Step 1: Add updated_at column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'contractors' 
        AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE contractors 
        ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
        
        -- Update existing rows to have current timestamp
        UPDATE contractors 
        SET updated_at = NOW() 
        WHERE updated_at IS NULL;
    END IF;
END $$;

-- Step 2: Ensure the column has a default value
ALTER TABLE contractors 
    ALTER COLUMN updated_at SET DEFAULT NOW();

-- Step 3: Drop existing trigger if it exists
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

-- Step 4: Create trigger for both INSERT and UPDATE
-- This trigger will fire for both INSERT and UPDATE operations, including those from UPSERT
CREATE TRIGGER contractors_updated_at
    BEFORE INSERT OR UPDATE ON contractors
    FOR EACH ROW
    EXECUTE FUNCTION update_contractors_updated_at();

-- Comments
COMMENT ON FUNCTION update_contractors_updated_at() IS 'Автоматически устанавливает updated_at при INSERT, UPDATE и UPSERT для таблицы contractors';
COMMENT ON TRIGGER contractors_updated_at ON contractors IS 'Триггер для автоматического обновления updated_at';

