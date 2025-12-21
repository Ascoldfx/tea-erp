-- Migration: Clear All Data for Fresh Import
-- Description: Удаляет все материалы, планирование и связанные данные
-- ВНИМАНИЕ: Это удалит ВСЕ данные! Используйте только для полной очистки перед новым импортом.
-- 
-- ИНСТРУКЦИЯ:
-- 1. Выполните этот SQL скрипт в Supabase SQL Editor
-- 2. Откройте приложение в браузере и перезагрузите страницу (localStorage будет очищен автоматически)
-- 3. Начните импорт в следующем порядке:
--    - Сначала техкарты (импорт из Excel)
--    - Потом общий список материалов (импорт из Excel)
--    - Потом картонная упаковка отдельно (импорт из Excel)
--
-- ПРИМЕЧАНИЕ: Техкарты (recipes) хранятся только в localStorage, не в базе данных.
-- Они будут очищены автоматически при загрузке страницы.

-- 1. Удаляем все движения материалов (stock_movements)
DELETE FROM stock_movements;

-- 2. Удаляем все остатки на складах (stock_levels)
DELETE FROM stock_levels;

-- 3. Удаляем все плановые расходы (planned_consumption)
DELETE FROM planned_consumption;

-- 4. Удаляем все передачи материалов подрядчикам (material_transfers) - если таблица существует
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'material_transfers') THEN
        DELETE FROM material_transfers;
    END IF;
EXCEPTION
    WHEN undefined_table THEN
        NULL;
END $$;

-- 5. Удаляем все заказы на производство (production_orders) - если таблица существует
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'production_orders') THEN
        DELETE FROM production_orders;
    END IF;
EXCEPTION
    WHEN undefined_table THEN
        NULL;
END $$;

-- 6. Удаляем все позиции заказов (order_items) - если таблица существует
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'order_items') THEN
        DELETE FROM order_items;
    END IF;
EXCEPTION
    WHEN undefined_table THEN
        NULL;
END $$;

-- 7. Удаляем все заказы (orders) - если таблица существует
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'orders') THEN
        DELETE FROM orders;
    END IF;
EXCEPTION
    WHEN undefined_table THEN
        NULL;
END $$;

-- 8. Удаляем все материалы (items) - В ПОСЛЕДНЮЮ ОЧЕРЕДЬ
-- Это нужно делать последним, так как другие таблицы ссылаются на items
DELETE FROM items;

-- Проверка: показываем количество записей после удаления
SELECT 
    (SELECT COUNT(*) FROM items) as items_count,
    (SELECT COUNT(*) FROM stock_levels) as stock_levels_count,
    (SELECT COUNT(*) FROM stock_movements) as stock_movements_count,
    (SELECT COUNT(*) FROM planned_consumption) as planned_consumption_count,
    (SELECT 
        CASE 
            WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'production_orders') 
            THEN (SELECT COUNT(*) FROM production_orders)
            ELSE 0
        END
    ) as production_orders_count,
    (SELECT 
        CASE 
            WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'material_transfers') 
            THEN (SELECT COUNT(*) FROM material_transfers)
            ELSE 0
        END
    ) as material_transfers_count,
    (SELECT 
        CASE 
            WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'orders') 
            THEN (SELECT COUNT(*) FROM orders)
            ELSE 0
        END
    ) as orders_count,
    (SELECT 
        CASE 
            WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'order_items') 
            THEN (SELECT COUNT(*) FROM order_items)
            ELSE 0
        END
    ) as order_items_count;

-- Все должно быть 0 после выполнения
-- Техкарты хранятся в localStorage и будут очищены автоматически при загрузке страницы
