-- Migration: Fix contractors updated_at trigger for INSERT operations
-- Description: Update trigger to handle both INSERT and UPDATE operations

-- Drop existing trigger
DROP TRIGGER IF EXISTS contractors_updated_at ON contractors;

-- Update function to handle both INSERT and UPDATE
CREATE OR REPLACE FUNCTION update_contractors_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    -- Set updated_at on INSERT (if not already set)
    IF TG_OP = 'INSERT' THEN
        IF NEW.updated_at IS NULL THEN
            NEW.updated_at = NOW();
        END IF;
    END IF;
    
    -- Always update updated_at on UPDATE
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

