-- Migration: Create Recipes Backup Table
-- Description: Создает таблицу для автоматического бэкапа техкарт

-- Table: recipes_backup
-- Автоматические бэкапы техкарт (создаются при каждом изменении)
CREATE TABLE IF NOT EXISTS recipes_backup (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipe_id TEXT NOT NULL,
    recipe_data JSONB NOT NULL,
    ingredients_data JSONB NOT NULL,
    backup_type TEXT NOT NULL CHECK (backup_type IN ('auto', 'manual')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    notes TEXT
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_recipes_backup_recipe_id ON recipes_backup(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipes_backup_created_at ON recipes_backup(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_recipes_backup_type ON recipes_backup(backup_type);

-- RLS Policies for recipes_backup
ALTER TABLE recipes_backup ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to view backups"
    ON recipes_backup FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow authenticated users to create backups"
    ON recipes_backup FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Comments for documentation
COMMENT ON TABLE recipes_backup IS 'Автоматические бэкапы техкарт для восстановления данных';
COMMENT ON COLUMN recipes_backup.backup_type IS 'auto - автоматический бэкап при изменении, manual - ручной бэкап';
COMMENT ON COLUMN recipes_backup.recipe_data IS 'JSON данные техкарты на момент бэкапа';
COMMENT ON COLUMN recipes_backup.ingredients_data IS 'JSON данные ингредиентов на момент бэкапа';

-- Function to automatically create backup before recipe update/delete
CREATE OR REPLACE FUNCTION backup_recipe_on_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Создаем бэкап перед обновлением или удалением
    IF TG_OP = 'UPDATE' OR TG_OP = 'DELETE' THEN
        INSERT INTO recipes_backup (recipe_id, recipe_data, ingredients_data, backup_type, created_by)
        SELECT 
            COALESCE(OLD.id, NEW.id),
            to_jsonb(COALESCE(OLD, NEW)),
            (
                SELECT jsonb_agg(to_jsonb(ri))
                FROM recipe_ingredients ri
                WHERE ri.recipe_id = COALESCE(OLD.id, NEW.id)
            ),
            'auto',
            COALESCE(OLD.created_by, NEW.created_by)
        WHERE EXISTS (
            SELECT 1 FROM recipes WHERE id = COALESCE(OLD.id, NEW.id)
        );
    END IF;
    
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-backup on recipe update
CREATE TRIGGER recipes_backup_on_update
    BEFORE UPDATE ON recipes
    FOR EACH ROW
    EXECUTE FUNCTION backup_recipe_on_change();

-- Trigger to auto-backup on recipe delete
CREATE TRIGGER recipes_backup_on_delete
    BEFORE DELETE ON recipes
    FOR EACH ROW
    EXECUTE FUNCTION backup_recipe_on_change();

