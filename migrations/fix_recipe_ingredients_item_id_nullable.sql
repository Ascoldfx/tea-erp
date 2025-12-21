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
    
    -- Обновляем FOREIGN KEY constraint, чтобы он работал с NULL значениями
    -- FOREIGN KEY по умолчанию позволяет NULL, но нужно убедиться, что constraint правильно настроен
    IF EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'recipe_ingredients_item_id_fkey'
        AND table_name = 'recipe_ingredients'
    ) THEN
        -- Удаляем старое ограничение
        ALTER TABLE recipe_ingredients 
        DROP CONSTRAINT recipe_ingredients_item_id_fkey;
        
        -- Создаем новое ограничение с ON DELETE SET NULL для поддержки NULL значений
        ALTER TABLE recipe_ingredients 
        ADD CONSTRAINT recipe_ingredients_item_id_fkey 
        FOREIGN KEY (item_id) 
        REFERENCES items(id) 
        ON DELETE SET NULL;
        
        RAISE NOTICE 'Обновлен FOREIGN KEY constraint для item_id с поддержкой NULL';
    END IF;
    
    -- Проверяем и обновляем ограничение UNIQUE, если нужно
    -- В PostgreSQL несколько NULL значений считаются разными для UNIQUE
    -- Но нам нужно убедиться, что ограничение правильно настроено
    -- Оставляем существующее UNIQUE(recipe_id, item_id) - оно работает правильно с NULL
    -- NULL значения считаются разными, поэтому несколько записей с NULL item_id в одной техкарте разрешены
END $$;

-- Комментарий для документации
COMMENT ON COLUMN recipe_ingredients.item_id IS 'ID материала из таблицы items. Может быть NULL для временных материалов (temp-...). В этом случае используется temp_material_sku и temp_material_name. Несколько записей с NULL item_id могут быть в одной техкарте, так как они могут быть разными временными материалами.';

