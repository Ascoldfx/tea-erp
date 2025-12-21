-- Migration: Fix Backup Function to Handle NULL Ingredients
-- Description: Исправляет функцию бэкапа, чтобы она возвращала пустой массив вместо NULL при отсутствии ингредиентов
-- Также проверяет наличие колонки retention_days перед использованием

-- Исправляем функцию backup_recipe_on_change() чтобы она обрабатывала случай, когда ингредиентов нет
CREATE OR REPLACE FUNCTION backup_recipe_on_change()
RETURNS TRIGGER AS $$
DECLARE
    backup_id UUID;
    recipe_id_to_backup TEXT;
    ingredients_json JSONB;
    has_retention_days BOOLEAN;
    has_limit_function BOOLEAN;
BEGIN
    -- Создаем бэкап перед обновлением или удалением
    IF TG_OP = 'UPDATE' OR TG_OP = 'DELETE' THEN
        recipe_id_to_backup := COALESCE(OLD.id, NEW.id);
        
        -- Получаем ингредиенты (или пустой массив, если их нет)
        SELECT COALESCE(jsonb_agg(to_jsonb(ri)), '[]'::jsonb)
        INTO ingredients_json
        FROM recipe_ingredients ri
        WHERE ri.recipe_id = recipe_id_to_backup;
        
        -- Проверяем наличие колонки retention_days
        SELECT EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_name = 'recipes_backup' 
            AND column_name = 'retention_days'
        ) INTO has_retention_days;
        
        -- Проверяем наличие функции limit_backups_per_recipe
        SELECT EXISTS (
            SELECT 1 
            FROM information_schema.routines 
            WHERE routine_name = 'limit_backups_per_recipe'
        ) INTO has_limit_function;
        
        -- Создаем бэкап только если рецепт существует
        IF EXISTS (SELECT 1 FROM recipes WHERE id = recipe_id_to_backup) THEN
            -- Вставляем данные в зависимости от наличия колонки retention_days
            IF has_retention_days THEN
                INSERT INTO recipes_backup (recipe_id, recipe_data, ingredients_data, backup_type, created_by, retention_days)
                VALUES (
                    recipe_id_to_backup,
                    to_jsonb(COALESCE(OLD, NEW)),
                    ingredients_json,
                    'auto',
                    COALESCE(OLD.created_by, NEW.created_by),
                    90
                )
                RETURNING id INTO backup_id;
            ELSE
                INSERT INTO recipes_backup (recipe_id, recipe_data, ingredients_data, backup_type, created_by)
                VALUES (
                    recipe_id_to_backup,
                    to_jsonb(COALESCE(OLD, NEW)),
                    ingredients_json,
                    'auto',
                    COALESCE(OLD.created_by, NEW.created_by)
                )
                RETURNING id INTO backup_id;
            END IF;
            
            -- Ограничиваем количество бэкапов для этой техкарты (оставляем последние 10)
            IF backup_id IS NOT NULL AND has_limit_function THEN
                PERFORM limit_backups_per_recipe(recipe_id_to_backup, 10);
            END IF;
        END IF;
    END IF;
    
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

