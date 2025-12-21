-- Migration: Clear Old Planned Consumption Data (Only Cardboard Packaging)
-- Description: Удаляет старые данные планирования для картонной упаковки
-- Это нужно, так как теперь планирование включает все материалы, а не только картонную упаковку

-- Удалить все записи планового расхода для картонной упаковки
DELETE FROM planned_consumption
WHERE item_id IN (
    SELECT id FROM items WHERE category = 'packaging_cardboard'
);

-- Проверка: показать количество оставшихся записей
SELECT COUNT(*) as remaining_records FROM planned_consumption;

-- Показать примеры оставшихся записей (если есть)
SELECT 
    pc.id,
    pc.item_id,
    i.sku,
    i.name,
    i.category,
    pc.planned_date,
    pc.quantity,
    pc.notes
FROM planned_consumption pc
LEFT JOIN items i ON pc.item_id = i.id
ORDER BY pc.planned_date DESC
LIMIT 20;

