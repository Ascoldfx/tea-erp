-- Migration: Import All Materials from Excel Table
-- Description: Bulk import of materials (items) and suppliers (contractors) from your Excel table
-- Instructions:
--   1. Execute this script in Supabase SQL Editor: https://supabase.com/dashboard/project/nhsnxypdprellsmouhlp/sql/new
--   2. Materials will appear immediately in the "Материалы" (Materials) page
--   3. Suppliers will appear in the "Поставщики" (Suppliers) page

-- ============================================
-- PART 1: INSERT SUPPLIERS (CONTRACTORS)
-- ============================================
-- Добавляем всех поставщиков из колонки "Основний постачальник"

INSERT INTO contractors (id, name, code, contact_person, phone, email)
VALUES
    ('supplier-dniprolak', 'Дніпролак', 'DNIPROLAK', NULL, NULL, NULL),
    ('supplier-imex-veska', 'Імекс Веска', 'IMEX-VESKA', NULL, NULL, NULL),
    ('supplier-tempo', 'TEMPO', 'TEMPO', NULL, NULL, NULL),
    ('supplier-dohler', 'Дьолер', 'DOHLER', NULL, NULL, NULL),
    ('supplier-esenti', 'Есенті', 'ESENTI', NULL, NULL, NULL),
    ('supplier-tc', 'TC', 'TC', NULL, NULL, NULL),
    ('supplier-cin', 'Cin', 'CIN', NULL, NULL, NULL),
    ('supplier-sumy', 'Суми', 'SUMY', NULL, NULL, NULL),
    ('supplier-svit-chayu', 'Світ Чаю', 'SVIT-CHAYU', NULL, NULL, NULL),
    ('supplier-fitofarm', 'Фітофарм', 'FITOFARM', NULL, NULL, NULL),
    ('supplier-torgtekhnika', 'Торгтехніка', 'TORGTEKHNIKA', NULL, NULL, NULL),
    ('supplier-sirnispey', 'Сирніспей', 'SIRNISPEY', NULL, NULL, NULL),
    ('supplier-papirus', 'Папірус', 'PAPIRUS', NULL, NULL, NULL)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    code = EXCLUDED.code,
    contact_person = EXCLUDED.contact_person,
    phone = EXCLUDED.phone,
    email = EXCLUDED.email;

-- ============================================
-- PART 2: INSERT MATERIALS (ITEMS)
-- ============================================
-- Добавляем все материалы из колонок "Артикул" и "Назва"
-- 
-- Категории:
--   'tea_bulk' - Чай/сырье (цедра, травы, плоды)
--   'flavor' - Ароматизаторы
--   'packaging_consumable' - Упаковка (пленка, бумага, этикетки, стикеры, нитки)
--   'packaging_box' - Коробки/пачки
--   'packaging_crate' - Гофроящики
--   'label' - Этикетки/ярлыки
--   'other' - Прочее
--
-- Единицы измерения:
--   'kg' - Килограммы
--   'pcs' - Штуки
--   'g' - Граммы
--   'l' - Литры
--   'ml' - Миллилитры

INSERT INTO items (id, sku, name, category, unit, min_stock_level)
VALUES
    -- Примеры материалов (замените на ваши данные из таблицы)
    ('2010246', '2010246', 'Ярлик Батік 28*32 (М)', 'label', 'pcs', 0),
    ('558822', '558822', 'Чайний ярлик під панетований чай "Arden"', 'label', 'pcs', 0),
    ('8411', '8411', 'Гранули Ароматизатор "Полуниця" 608411 Есенті', 'flavor', 'kg', 0),
    ('4788', '4788', 'Апельсинова цедра (для ф.л. чаю)', 'tea_bulk', 'kg', 0),
    ('8290', '8290', 'Г/я Універсальний для продукції з ИМА 23 415x289x160 на 24 пачки', 'packaging_crate', 'pcs', 0),
    ('14415', '14415', 'Плівка ТM "Batik OPA 150"', 'packaging_consumable', 'kg', 0),
    ('2010301', '2010301', 'Стікер на ящик Askold, Champagne Spills 20фл 24шт/ящ', 'label', 'pcs', 0),
    ('2010398', '2010398', 'Пакет GT PET12_print+matt-lac/Al-foil9/LDPE100 (80*250(45)/Arden Arabica 250g вакуум)', 'packaging_consumable', 'pcs', 0),
    ('2010455', '2010455', 'Папір Dynacrimp Non heatseal tea filter paper qual512/RL-TA. 12,8 g/m2.94mm', 'packaging_consumable', 'kg', 0),
    ('2010513', '2010513', 'Плівка п/п TATRAFAN SHT 20/275 (вовнішня к/у)', 'packaging_consumable', 'kg', 0)
    -- ДОБАВЬТЕ ОСТАЛЬНЫЕ МАТЕРИАЛЫ ЗДЕСЬ:
    -- ('АРТИКУЛ', 'АРТИКУЛ', 'Название материала', 'категория', 'единица', 0),
    -- ('АРТИКУЛ', 'АРТИКУЛ', 'Название материала', 'категория', 'единица', 0),
ON CONFLICT (id) DO UPDATE SET
    sku = EXCLUDED.sku,
    name = EXCLUDED.name,
    category = EXCLUDED.category,
    unit = EXCLUDED.unit,
    min_stock_level = EXCLUDED.min_stock_level;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================
-- Проверка импорта:

-- Количество поставщиков
SELECT COUNT(*) as total_suppliers FROM contractors;

-- Количество материалов
SELECT COUNT(*) as total_items FROM items;

-- Список всех поставщиков
SELECT id, name, code FROM contractors ORDER BY name;

-- Список всех материалов
SELECT id, sku, name, category, unit FROM items ORDER BY name;

