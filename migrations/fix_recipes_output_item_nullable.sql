-- Migration: Fix Recipes Output Item ID to Allow NULL
-- Description: Делает output_item_id nullable, чтобы разрешить временные значения (temp-*)

-- Делаем output_item_id nullable в таблице recipes
-- Это необходимо для техкарт, где готовая продукция еще не добавлена в базу данных
ALTER TABLE recipes 
ALTER COLUMN output_item_id DROP NOT NULL;

-- Удаляем ограничение внешнего ключа, если оно существует
-- Затем создаем новое с ON DELETE SET NULL для поддержки временных значений
DO $$
BEGIN
    -- Проверяем, существует ли ограничение
    IF EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'recipes_output_item_id_fkey'
        AND table_name = 'recipes'
    ) THEN
        -- Удаляем старое ограничение
        ALTER TABLE recipes 
        DROP CONSTRAINT recipes_output_item_id_fkey;
        
        -- Создаем новое ограничение с ON DELETE SET NULL
        -- Это позволит использовать NULL для временных значений
        ALTER TABLE recipes 
        ADD CONSTRAINT recipes_output_item_id_fkey 
        FOREIGN KEY (output_item_id) 
        REFERENCES items(id) 
        ON DELETE SET NULL;
    END IF;
END $$;

-- Комментарий для документации
COMMENT ON COLUMN recipes.output_item_id IS 'ID готовой продукции. Может быть NULL для временных техкарт (temp-*), которые еще не имеют готовой продукции в базе данных.';

