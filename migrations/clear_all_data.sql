-- Migration: Clear All Data for Fresh Import
-- Description: Удаляет все материалы, техкарты, планирование и связанные данные
-- ВНИМАНИЕ: Это удалит ВСЕ данные! Используйте только для полной очистки перед новым импортом.
-- 
-- ИНСТРУКЦИЯ:
-- 1. Выполните этот SQL скрипт в Supabase SQL Editor
-- 2. Откройте приложение в браузере и перезагрузите страницу (localStorage будет очищен автоматически)
-- 3. Начните импорт в следующем порядке:
--    - Сначала техкарты (импорт из Excel)
--    - Потом общий список материалов (импорт из Excel)
--    - Потом картонная упаковка отдельно (импорт из Excel)

-- 1. Удаляем все техкарты (recipes) из базы данных
-- Примечание: техкарты также хранятся в localStorage, они будут очищены автоматически при загрузке страницы
DELETE FROM recipes;

-- 2. Удаляем все движения материалов (stock_movements)
DELETE FROM stock_movements;

-- 3. Удаляем все остатки на складах (stock_levels)
DELETE FROM stock_levels;

-- 4. Удаляем все плановые расходы (planned_consumption)
DELETE FROM planned_consumption;

-- 5. Удаляем все передачи материалов подрядчикам (material_transfers)
DELETE FROM material_transfers;

-- 6. Удаляем все заказы на производство (production_orders)
DELETE FROM production_orders;

-- 7. Удаляем все позиции заказов (order_items)
DELETE FROM order_items;

-- 8. Удаляем все заказы (orders)
DELETE FROM orders;

-- 9. Удаляем все материалы (items) - В ПОСЛЕДНЮЮ ОЧЕРЕДЬ
-- Это нужно делать последним, так как другие таблицы ссылаются на items
DELETE FROM items;

-- Проверка: показываем количество записей после удаления
SELECT 
    (SELECT COUNT(*) FROM items) as items_count,
    (SELECT COUNT(*) FROM recipes) as recipes_count,
    (SELECT COUNT(*) FROM stock_levels) as stock_levels_count,
    (SELECT COUNT(*) FROM stock_movements) as stock_movements_count,
    (SELECT COUNT(*) FROM planned_consumption) as planned_consumption_count,
    (SELECT COUNT(*) FROM production_orders) as production_orders_count,
    (SELECT COUNT(*) FROM material_transfers) as material_transfers_count,
    (SELECT COUNT(*) FROM orders) as orders_count,
    (SELECT COUNT(*) FROM order_items) as order_items_count;

-- Все должно быть 0 после выполнения

