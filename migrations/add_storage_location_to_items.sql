-- Migration: Add storage_location column to items table
-- Description: Adds storage_location field to store location information from Excel imports

DO $$ 
BEGIN
    -- Add storage_location column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'items' AND column_name = 'storage_location'
    ) THEN
        ALTER TABLE items ADD COLUMN storage_location TEXT;
    END IF;
END $$;

-- Add comment
COMMENT ON COLUMN items.storage_location IS 'Место хранения материала (из Excel)';

