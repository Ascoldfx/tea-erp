-- Migration: Add monthly_norms column to recipe_ingredients
-- Description: Добавляет поле monthly_norms для хранения норм расхода по месяцам

-- Добавляем колонку monthly_norms (JSONB) для хранения норм по месяцам
ALTER TABLE recipe_ingredients 
ADD COLUMN IF NOT EXISTS monthly_norms JSONB DEFAULT NULL;

-- Комментарий для документации
COMMENT ON COLUMN recipe_ingredients.monthly_norms IS 'Нормы расхода материала по месяцам в формате JSONB: [{"date": "2025-12-01", "quantity": 0.65}, ...]. Дата всегда первого числа месяца (YYYY-MM-01).';

