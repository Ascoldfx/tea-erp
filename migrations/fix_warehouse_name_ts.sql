-- Migration: Fix Warehouse Name - Ensure ТС instead of Май
-- Description: Force update warehouse name from Май to ТС

-- Update warehouse name to ТС if it's currently Май
UPDATE warehouses
SET name = 'ТС', location = 'ТС'
WHERE id = 'wh-ts' AND (name = 'Май' OR name = 'МАЙ' OR location = 'Май' OR location = 'МАЙ');

-- Ensure wh-ts warehouse exists with correct name
INSERT INTO warehouses (id, name, location, type)
VALUES
    ('wh-ts', 'ТС', 'ТС', 'internal')
ON CONFLICT (id) DO UPDATE SET
    name = 'ТС',
    location = 'ТС',
    type = 'internal';

-- Verify
SELECT id, name, location FROM warehouses WHERE id = 'wh-ts';

