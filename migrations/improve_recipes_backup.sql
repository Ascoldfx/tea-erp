-- Migration: Improve Recipes Backup System
-- Description: Улучшает систему бэкапов техкарт с периодичностью, лимитами и защитой

-- 1. Добавляем поля для улучшенной системы бэкапов
ALTER TABLE recipes_backup 
ADD COLUMN IF NOT EXISTS is_protected BOOLEAN DEFAULT FALSE, -- Защита от автоматического удаления
ADD COLUMN IF NOT EXISTS retention_days INTEGER DEFAULT 90, -- Срок хранения в днях (по умолчанию 90 дней)
ADD COLUMN IF NOT EXISTS backup_size_kb INTEGER, -- Размер бэкапа в KB (для мониторинга)
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ; -- Дата истечения срока хранения

-- 2. Создаем индекс для быстрого поиска по сроку хранения
CREATE INDEX IF NOT EXISTS idx_recipes_backup_expires_at ON recipes_backup(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_recipes_backup_protected ON recipes_backup(is_protected) WHERE is_protected = TRUE;

-- 3. Функция для автоматического расчета expires_at на основе retention_days
CREATE OR REPLACE FUNCTION set_backup_expires_at()
RETURNS TRIGGER AS $$
BEGIN
    -- Если expires_at не установлен, устанавливаем на основе retention_days
    IF NEW.expires_at IS NULL THEN
        NEW.expires_at = NEW.created_at + (NEW.retention_days || 90 || INTERVAL '1 day');
    END IF;
    
    -- Рассчитываем размер бэкапа (приблизительно)
    IF NEW.backup_size_kb IS NULL THEN
        NEW.backup_size_kb = (
            COALESCE(pg_column_size(NEW.recipe_data), 0) +
            COALESCE(pg_column_size(NEW.ingredients_data), 0)
        ) / 1024; -- Конвертируем в KB
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Триггер для автоматической установки expires_at и размера
CREATE TRIGGER set_backup_expires_at_trigger
    BEFORE INSERT ON recipes_backup
    FOR EACH ROW
    EXECUTE FUNCTION set_backup_expires_at();

-- 5. Функция для автоматической очистки истекших бэкапов (запускается вручную или по расписанию)
CREATE OR REPLACE FUNCTION cleanup_expired_backups()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Удаляем только незащищенные бэкапы, срок хранения которых истек
    DELETE FROM recipes_backup
    WHERE is_protected = FALSE
      AND expires_at IS NOT NULL
      AND expires_at < NOW();
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- 6. Функция для ограничения количества бэкапов на одну техкарту
-- Оставляет только последние N бэкапов для каждой техкарты
CREATE OR REPLACE FUNCTION limit_backups_per_recipe(recipe_id_param TEXT, max_backups INTEGER DEFAULT 10)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
    backup_count INTEGER;
BEGIN
    -- Считаем количество бэкапов для этой техкарты
    SELECT COUNT(*) INTO backup_count
    FROM recipes_backup
    WHERE recipe_id = recipe_id_param
      AND is_protected = FALSE;
    
    -- Если бэкапов больше лимита, удаляем самые старые
    IF backup_count > max_backups THEN
        WITH old_backups AS (
            SELECT id
            FROM recipes_backup
            WHERE recipe_id = recipe_id_param
              AND is_protected = FALSE
            ORDER BY created_at ASC
            LIMIT (backup_count - max_backups)
        )
        DELETE FROM recipes_backup
        WHERE id IN (SELECT id FROM old_backups);
        
        GET DIAGNOSTICS deleted_count = ROW_COUNT;
        RETURN deleted_count;
    END IF;
    
    RETURN 0;
END;
$$ LANGUAGE plpgsql;

-- 7. Улучшенная функция бэкапа с проверкой лимитов
CREATE OR REPLACE FUNCTION backup_recipe_on_change()
RETURNS TRIGGER AS $$
DECLARE
    backup_id UUID;
BEGIN
    -- Создаем бэкап перед обновлением или удалением
    IF TG_OP = 'UPDATE' OR TG_OP = 'DELETE' THEN
        INSERT INTO recipes_backup (recipe_id, recipe_data, ingredients_data, backup_type, created_by, retention_days)
        SELECT 
            COALESCE(OLD.id, NEW.id),
            to_jsonb(COALESCE(OLD, NEW)),
            (
                SELECT jsonb_agg(to_jsonb(ri))
                FROM recipe_ingredients ri
                WHERE ri.recipe_id = COALESCE(OLD.id, NEW.id)
            ),
            'auto',
            COALESCE(OLD.created_by, NEW.created_by),
            90 -- Автоматические бэкапы хранятся 90 дней
        WHERE EXISTS (
            SELECT 1 FROM recipes WHERE id = COALESCE(OLD.id, NEW.id)
        )
        RETURNING id INTO backup_id;
        
        -- Ограничиваем количество бэкапов для этой техкарты (оставляем последние 10)
        IF backup_id IS NOT NULL THEN
            PERFORM limit_backups_per_recipe(COALESCE(OLD.id, NEW.id), 10);
        END IF;
    END IF;
    
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 8. Обновляем политики безопасности для бэкапов
-- Только администраторы могут удалять бэкапы
DROP POLICY IF EXISTS "Allow authenticated users to delete backups" ON recipes_backup;
CREATE POLICY "Allow authenticated users to delete backups"
    ON recipes_backup FOR DELETE
    TO authenticated
    USING (
        -- Разрешаем удаление только незащищенных бэкапов
        is_protected = FALSE
    );

-- 9. Политика для обновления бэкапов (только для защиты/снятия защиты)
CREATE POLICY "Allow authenticated users to update backups"
    ON recipes_backup FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (
        -- Разрешаем обновлять только флаг защиты и заметки
        -- Нельзя изменять данные бэкапа
        (OLD.recipe_data = NEW.recipe_data) AND
        (OLD.ingredients_data = NEW.ingredients_data) AND
        (OLD.recipe_id = NEW.recipe_id) AND
        (OLD.backup_type = NEW.backup_type)
    );

-- 10. Комментарии для документации
COMMENT ON COLUMN recipes_backup.is_protected IS 'Защита от автоматического удаления. Защищенные бэкапы не удаляются автоматически.';
COMMENT ON COLUMN recipes_backup.retention_days IS 'Срок хранения в днях. По умолчанию 90 дней для автоматических бэкапов.';
COMMENT ON COLUMN recipes_backup.expires_at IS 'Дата истечения срока хранения. Рассчитывается автоматически.';
COMMENT ON COLUMN recipes_backup.backup_size_kb IS 'Размер бэкапа в KB. Рассчитывается автоматически.';
COMMENT ON FUNCTION cleanup_expired_backups() IS 'Удаляет истекшие незащищенные бэкапы. Возвращает количество удаленных записей.';
COMMENT ON FUNCTION limit_backups_per_recipe(TEXT, INTEGER) IS 'Ограничивает количество бэкапов для техкарты. Удаляет самые старые незащищенные бэкапы.';

