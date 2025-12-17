-- Migration: Fix contractors updated_at trigger for INSERT and UPDATE
-- Description: Ensure updated_at is handled correctly for both INSERT and UPDATE operations

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS contractors_updated_at ON contractors;

-- Update function to handle both INSERT and UPDATE
CREATE OR REPLACE FUNCTION update_contractors_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    -- For INSERT: set updated_at if not already set (should use DEFAULT, but ensure it's set)
    IF TG_OP = 'INSERT' THEN
        IF NEW.updated_at IS NULL THEN
            NEW.updated_at = NOW();
        END IF;
    END IF;
    
    -- For UPDATE: always update updated_at
    IF TG_OP = 'UPDATE' THEN
        NEW.updated_at = NOW();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for both INSERT and UPDATE
CREATE TRIGGER contractors_updated_at
    BEFORE INSERT OR UPDATE ON contractors
    FOR EACH ROW
    EXECUTE FUNCTION update_contractors_updated_at();

-- Comments
COMMENT ON FUNCTION update_contractors_updated_at() IS 'Автоматически устанавливает updated_at при INSERT и UPDATE для таблицы contractors';

