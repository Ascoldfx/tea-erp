-- Migration: Clear Planned Consumption Data
-- Description: Удаляет все данные из таблицы planned_consumption
-- ВНИМАНИЕ: Это удалит ВСЕ записи планового расхода. Используйте с осторожностью!

-- Вариант 1: Удалить все записи планового расхода
DELETE FROM planned_consumption;

-- Вариант 2: Удалить только записи, импортированные из Excel (с примечанием "Импортировано из Excel")
-- Раскомментируйте, если хотите удалить только импортированные данные:
-- DELETE FROM planned_consumption WHERE notes = 'Импортировано из Excel';

-- Вариант 3: Удалить записи для конкретного месяца (например, декабрь 2025)
-- Раскомментируйте и измените дату, если нужно:
-- DELETE FROM planned_consumption WHERE planned_date >= '2025-12-01' AND planned_date < '2026-01-01';

-- Вариант 4: Удалить записи, где item_id является кодом (SKU), а не UUID
-- Это удалит старые записи, которые были сохранены с кодом вместо UUID
-- Раскомментируйте, если нужно:
-- DELETE FROM planned_consumption 
-- WHERE item_id NOT IN (SELECT id FROM items);

-- Проверка: показать количество оставшихся записей
SELECT COUNT(*) as remaining_records FROM planned_consumption;

-- Показать примеры оставшихся записей (если есть)
SELECT 
    pc.id,
    pc.item_id,
    i.sku,
    i.name,
    pc.planned_date,
    pc.quantity,
    pc.notes
FROM planned_consumption pc
LEFT JOIN items i ON pc.item_id = i.id
ORDER BY pc.planned_date DESC
LIMIT 10;

