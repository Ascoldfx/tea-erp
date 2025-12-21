-- Migration: Fix recipe_ingredients item_id to Allow NULL
-- Description: Делает item_id nullable в таблице recipe_ingredients для поддержки временных материалов

-- Проверяем и делаем item_id nullable, если еще не сделано
DO $$
BEGIN
    -- Проверяем, есть ли ограничение NOT NULL на item_id
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'recipe_ingredients' 
        AND column_name = 'item_id' 
        AND is_nullable = 'NO'
    ) THEN
        -- Удаляем ограничение NOT NULL
        ALTER TABLE recipe_ingredients 
        ALTER COLUMN item_id DROP NOT NULL;
        
        RAISE NOTICE 'Колонка item_id в recipe_ingredients теперь nullable';
    ELSE
        RAISE NOTICE 'Колонка item_id в recipe_ingredients уже nullable';
    END IF;
    
    -- Проверяем и обновляем ограничение UNIQUE, если нужно
    -- UNIQUE(recipe_id, item_id) должно работать с NULL значениями
    -- В PostgreSQL несколько NULL значений считаются разными для UNIQUE
    -- Но нам нужно убедиться, что ограничение правильно настроено
    
    -- Удаляем старое ограничение UNIQUE, если оно существует
    IF EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'recipe_ingredients_recipe_id_item_id_key'
        AND table_name = 'recipe_ingredients'
    ) THEN
        -- Удаляем старое ограничение
        ALTER TABLE recipe_ingredients 
        DROP CONSTRAINT recipe_ingredients_recipe_id_item_id_key;
        
        -- Создаем частичный уникальный индекс, который работает правильно с NULL
        -- Это позволит иметь несколько записей с NULL item_id в одной техкарте
        -- но предотвратит дубликаты для не-NULL значений
        CREATE UNIQUE INDEX IF NOT EXISTS recipe_ingredients_recipe_id_item_id_unique 
        ON recipe_ingredients(recipe_id, item_id) 
        WHERE item_id IS NOT NULL;
        
        RAISE NOTICE 'Создан частичный уникальный индекс для recipe_id и item_id (только для не-NULL значений)';
    END IF;
END $$;

-- Комментарий для документации
COMMENT ON COLUMN recipe_ingredients.item_id IS 'ID материала из таблицы items. Может быть NULL для временных материалов (temp-...). В этом случае используется temp_material_sku и temp_material_name. Несколько записей с NULL item_id могут быть в одной техкарте, так как они могут быть разными временными материалами.';

