-- Migration: Fix recipe_ingredients to allow nullable item_id
-- Description: Позволяет сохранять ингредиенты с временными ID (temp-...)

-- Делаем item_id nullable, чтобы можно было сохранять ингредиенты с временными ID
ALTER TABLE recipe_ingredients 
ALTER COLUMN item_id DROP NOT NULL;

-- Обновляем FOREIGN KEY, чтобы он работал с NULL значениями
-- (FOREIGN KEY по умолчанию позволяет NULL)
-- Если нужно, можно добавить проверку:
-- ALTER TABLE recipe_ingredients
-- DROP CONSTRAINT IF EXISTS recipe_ingredients_item_id_fkey;

-- Добавляем комментарий
COMMENT ON COLUMN recipe_ingredients.item_id IS 'ID материала из таблицы items. Может быть NULL для временных материалов (temp-...). В этом случае используется temp_material_sku и temp_material_name.';

