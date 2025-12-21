-- Migration: Create Recipes Table
-- Description: Создает таблицу для хранения техкарт (рецептур) на сервере

-- Table: recipes
-- Технологические карты (рецептуры) для производства готовой продукции
CREATE TABLE IF NOT EXISTS recipes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    output_item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    output_quantity DECIMAL(10, 2) NOT NULL DEFAULT 1 CHECK (output_quantity > 0),
    actual_quantity DECIMAL(10, 2),
    materials_handover_date TIMESTAMPTZ,
    materials_accepted_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Table: recipe_ingredients
-- Ингредиенты (материалы) для каждой техкарты
CREATE TABLE IF NOT EXISTS recipe_ingredients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipe_id TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    quantity DECIMAL(10, 4) NOT NULL CHECK (quantity >= 0),
    tolerance DECIMAL(5, 2),
    is_duplicate_sku BOOLEAN DEFAULT FALSE,
    is_auto_created BOOLEAN DEFAULT FALSE,
    temp_material_sku TEXT,
    temp_material_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Один материал может быть в одной техкарте только один раз
    UNIQUE(recipe_id, item_id)
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_recipes_output_item ON recipes(output_item_id);
CREATE INDEX IF NOT EXISTS idx_recipes_created ON recipes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_recipe ON recipe_ingredients(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_item ON recipe_ingredients(item_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_recipes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER recipes_updated_at
    BEFORE UPDATE ON recipes
    FOR EACH ROW
    EXECUTE FUNCTION update_recipes_updated_at();

-- RLS Policies for recipes
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to manage recipes"
    ON recipes FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- RLS Policies for recipe_ingredients
ALTER TABLE recipe_ingredients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to manage recipe ingredients"
    ON recipe_ingredients FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Comments for documentation
COMMENT ON TABLE recipes IS 'Технологические карты (рецептуры) для производства готовой продукции';
COMMENT ON TABLE recipe_ingredients IS 'Ингредиенты (материалы) для каждой техкарты';
COMMENT ON COLUMN recipes.output_quantity IS 'Базовая единица производства (например, 1 ящик)';
COMMENT ON COLUMN recipe_ingredients.quantity IS 'Количество материала на базовую единицу производства';
COMMENT ON COLUMN recipe_ingredients.is_duplicate_sku IS 'True если несколько материалов имеют одинаковый артикул';
COMMENT ON COLUMN recipe_ingredients.is_auto_created IS 'True если материал был автоматически создан при импорте';

