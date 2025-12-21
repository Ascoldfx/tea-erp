-- Migration: Add New Contractors (Кава, Бакалея, ТС Трейд)
-- Description: Add three new contractors to the contractors table

INSERT INTO contractors (id, name, code, contact_person, phone, email)
VALUES
    ('wh-kava', 'Кава', 'KAVA', NULL, NULL, NULL),
    ('wh-bakaleya', 'Бакалея', 'BAKALEYA', NULL, NULL, NULL),
    ('wh-ts-treyd', 'ТС Трейд', 'TS-TREYD', NULL, NULL, NULL)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    code = EXCLUDED.code;

-- Create warehouses for new contractors
INSERT INTO warehouses (id, name, location, type, contractor_id)
VALUES
    ('wh-kava', 'Кава', 'Кава', 'contractor', 'wh-kava'),
    ('wh-bakaleya', 'Бакалея', 'Бакалея', 'contractor', 'wh-bakaleya'),
    ('wh-ts-treyd', 'ТС Трейд', 'ТС Трейд', 'contractor', 'wh-ts-treyd')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    location = EXCLUDED.location,
    type = EXCLUDED.type,
    contractor_id = EXCLUDED.contractor_id;

