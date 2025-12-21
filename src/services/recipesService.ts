import { supabase } from '../lib/supabase';
import type { Recipe, RecipeIngredient } from '../types/production';

export interface RecipeDB {
    id: string;
    name: string;
    description?: string;
    output_item_id: string | null; // Может быть NULL для временных техкарт
    output_quantity: number;
    actual_quantity?: number;
    materials_handover_date?: string;
    materials_accepted_date?: string;
    created_at?: string;
    updated_at?: string;
}

export interface RecipeIngredientDB {
    id?: string;
    recipe_id: string;
    item_id: string | null; // Может быть NULL для временных материалов
    quantity: number;
    tolerance?: number;
    is_duplicate_sku?: boolean;
    is_auto_created?: boolean;
    temp_material_sku?: string;
    temp_material_name?: string;
    monthly_norms?: Array<{ date: string; quantity: number }> | null; // Нормы по месяцам
}

export const recipesService = {
    /**
     * Получить все техкарты из базы данных
     */
    async getRecipes(): Promise<Recipe[]> {
        if (!supabase) {
            console.warn('[RecipesService] Supabase not available');
            return [];
        }

        try {
            // Загружаем техкарты
            const { data: recipesData, error: recipesError } = await supabase
                .from('recipes')
                .select('*')
                .order('created_at', { ascending: false });

            if (recipesError) {
                console.error('[RecipesService] Error fetching recipes:', recipesError);
                return [];
            }

            if (!recipesData || recipesData.length === 0) {
                return [];
            }

            // Загружаем ингредиенты для всех техкарт
            const recipeIds = recipesData.map(r => r.id);
            const { data: ingredientsData, error: ingredientsError } = await supabase
                .from('recipe_ingredients')
                .select('*')
                .in('recipe_id', recipeIds);

            if (ingredientsError) {
                console.error('[RecipesService] Error fetching ingredients:', ingredientsError);
            }

            // Группируем ингредиенты по recipe_id
            const ingredientsMap = new Map<string, RecipeIngredient[]>();
            if (ingredientsData) {
                ingredientsData.forEach((ing: RecipeIngredientDB) => {
                    if (!ingredientsMap.has(ing.recipe_id)) {
                        ingredientsMap.set(ing.recipe_id, []);
                    }
                    // Если item_id NULL, используем временный ID из temp_material_sku
                    const itemId = ing.item_id || (ing.temp_material_sku ? `temp-${ing.temp_material_sku}` : `temp-unknown-${Date.now()}`);
                    
                    const ingredient: RecipeIngredient = {
                        itemId: itemId,
                        quantity: ing.quantity,
                        tolerance: ing.tolerance,
                        isDuplicateSku: ing.is_duplicate_sku,
                        isAutoCreated: ing.is_auto_created,
                        tempMaterial: ing.temp_material_sku && ing.temp_material_name
                            ? { sku: ing.temp_material_sku, name: ing.temp_material_name }
                            : (ing.item_id ? undefined : { sku: ing.temp_material_sku || 'UNKNOWN', name: ing.temp_material_name || 'Неизвестный материал' })
                    };
                    
                    // Загружаем нормы по месяцам, если они есть
                    if (ing.monthly_norms) {
                        // PostgreSQL JSONB может вернуть объект или массив
                        let monthlyNormsArray: Array<{ date: string; quantity: number }> | null = null;
                        
                        if (Array.isArray(ing.monthly_norms)) {
                            monthlyNormsArray = ing.monthly_norms;
                        } else if (typeof ing.monthly_norms === 'object' && ing.monthly_norms !== null) {
                            // Если это объект, пытаемся преобразовать в массив
                            try {
                                monthlyNormsArray = JSON.parse(JSON.stringify(ing.monthly_norms));
                                if (!Array.isArray(monthlyNormsArray)) {
                                    monthlyNormsArray = null;
                                }
                            } catch (e) {
                                console.warn('[RecipesService] Error parsing monthly_norms:', e);
                                monthlyNormsArray = null;
                            }
                        }
                        
                        if (monthlyNormsArray && monthlyNormsArray.length > 0) {
                            ingredient.monthlyNorms = monthlyNormsArray;
                            console.log(`[RecipesService] Loaded ${monthlyNormsArray.length} monthly norms for ingredient ${ing.temp_material_sku || ing.item_id}`);
                        }
                    }
                    
                    ingredientsMap.get(ing.recipe_id)!.push(ingredient);
                });
            }

            // Преобразуем в формат Recipe
            const recipes: Recipe[] = recipesData.map((r: RecipeDB) => ({
                id: r.id,
                name: r.name,
                description: r.description || undefined,
                outputItemId: r.output_item_id || `temp-${r.id}`, // Если NULL, используем временный ID
                outputQuantity: r.output_quantity,
                actualQuantity: r.actual_quantity,
                materialsHandoverDate: r.materials_handover_date,
                materialsAcceptedDate: r.materials_accepted_date,
                ingredients: ingredientsMap.get(r.id) || []
            }));

            console.log(`[RecipesService] Loaded ${recipes.length} recipes from database`);
            return recipes;
        } catch (error) {
            console.error('[RecipesService] Exception fetching recipes:', error);
            return [];
        }
    },

    /**
     * Сохранить техкарту в базу данных
     */
    async saveRecipe(recipe: Recipe): Promise<boolean> {
        if (!supabase) {
            console.warn('[RecipesService] Supabase not available');
            return false;
        }

        try {
            // Сохраняем техкарту
            // ВАЖНО: Если outputItemId начинается с "temp-", используем NULL
            // так как внешний ключ не позволит сохранить несуществующий ID
            const outputItemId = recipe.outputItemId && !recipe.outputItemId.startsWith('temp-') 
                ? recipe.outputItemId 
                : null;
            
            const recipeData: RecipeDB = {
                id: recipe.id,
                name: recipe.name,
                description: recipe.description || undefined,
                output_item_id: outputItemId,
                output_quantity: recipe.outputQuantity,
                actual_quantity: recipe.actualQuantity || undefined,
                materials_handover_date: recipe.materialsHandoverDate || undefined,
                materials_accepted_date: recipe.materialsAcceptedDate || undefined
            };

            const { error: recipeError } = await supabase
                .from('recipes')
                .upsert(recipeData, { onConflict: 'id' });

            if (recipeError) {
                console.error('[RecipesService] Error saving recipe:', recipeError);
                return false;
            }

            // Удаляем старые ингредиенты ПЕРЕД вставкой новых
            // ВАЖНО: Это должно происходить до вставки, чтобы избежать конфликтов UNIQUE
            const { error: deleteError } = await supabase
                .from('recipe_ingredients')
                .delete()
                .eq('recipe_id', recipe.id);

            if (deleteError) {
                console.error('[RecipesService] Error deleting old ingredients:', deleteError);
                // НЕ продолжаем, если не удалось удалить старые - это может привести к дубликатам
                return false;
            }

            // Сохраняем новые ингредиенты
            if (recipe.ingredients && recipe.ingredients.length > 0) {
                // ВАЖНО: Фильтруем ингредиенты с временными ID (temp-...)
                // Они не могут быть сохранены в recipe_ingredients, так как item_id должен ссылаться на существующий items.id
                // Но мы сохраняем информацию о них в temp_material_sku и temp_material_name
                const validIngredients = recipe.ingredients.filter(ing => {
                    // Пропускаем ингредиенты с временным ID, если нет tempMaterial
                    if (ing.itemId.startsWith('temp-') && !ing.tempMaterial) {
                        console.warn(`[RecipesService] Пропущен ингредиент с временным ID без tempMaterial: ${ing.itemId}`);
                        return false;
                    }
                    return true;
                });

                if (validIngredients.length > 0) {
                    // ВАЖНО: Убираем дубликаты ТОЛЬКО в рамках одной техкарты (recipe_id)
                    // Один и тот же материал (item_id) может использоваться в разных техкартах - это нормально
                    // Группируем по (recipe_id, item_id) и берем последний (самый актуальный)
                    const ingredientsMap = new Map<string, RecipeIngredientDB>();
                    
                    validIngredients.forEach(ing => {
                        // Если itemId начинается с temp-, используем null для item_id
                        // Но сохраняем информацию в temp_material_sku и temp_material_name
                        const itemId = ing.itemId.startsWith('temp-') ? null : ing.itemId;
                        
                        // Создаем ключ для уникальности: recipe_id + item_id (или temp_material_sku для NULL)
                        const uniqueKey = itemId 
                            ? `${recipe.id}_${itemId}` 
                            : `${recipe.id}_null_${ing.tempMaterial?.sku || ing.itemId}`;
                        
                        // Если уже есть такой ингредиент, заменяем его (берем последний)
                        ingredientsMap.set(uniqueKey, {
                            recipe_id: recipe.id,
                            item_id: itemId, // NULL для временных материалов, string для существующих
                            quantity: ing.quantity,
                            tolerance: ing.tolerance || undefined,
                            is_duplicate_sku: ing.isDuplicateSku || false,
                            is_auto_created: ing.isAutoCreated || false,
                            temp_material_sku: ing.tempMaterial?.sku || (ing.itemId.startsWith('temp-') ? ing.itemId.replace('temp-', '') : undefined),
                            temp_material_name: ing.tempMaterial?.name || undefined,
                            monthly_norms: ing.monthlyNorms && ing.monthlyNorms.length > 0 
                                ? (ing.monthlyNorms as any) // JSONB в PostgreSQL принимает массив напрямую
                                : null
                        });
                    });

                    const ingredientsData = Array.from(ingredientsMap.values());

                    // Сохраняем ВСЕ ингредиенты, включая временные (с NULL item_id)
                    console.log(`[RecipesService] Сохранение ${ingredientsData.length} ингредиентов для тех.карты "${recipe.name}" (после удаления дубликатов из ${validIngredients.length})`);
                    const { error: ingredientsError, data: insertedIngredients } = await supabase
                        .from('recipe_ingredients')
                        .insert(ingredientsData)
                        .select();

                    if (ingredientsError) {
                        console.error('[RecipesService] Error saving ingredients:', ingredientsError);
                        console.error('[RecipesService] Ingredients data (first 3):', ingredientsData.slice(0, 3));
                        console.error('[RecipesService] Full error details:', JSON.stringify(ingredientsError, null, 2));
                        return false;
                    }
                    
                    const validCount = ingredientsData.filter(ing => ing.item_id).length;
                    const tempCount = ingredientsData.filter(ing => !ing.item_id).length;
                    console.log(`[RecipesService] ✅ Сохранено ${insertedIngredients?.length || 0} ингредиентов для тех.карты "${recipe.name}" (${validCount} valid, ${tempCount} temp)`);
                } else {
                    console.warn(`[RecipesService] Recipe "${recipe.name}" has no valid ingredients to save`);
                }
            }

            console.log(`[RecipesService] Recipe "${recipe.name}" saved successfully`);
            return true;
        } catch (error) {
            console.error('[RecipesService] Exception saving recipe:', error);
            return false;
        }
    },

    /**
     * Сохранить несколько техкарт в базу данных
     * ВАЖНО: Сохраняет все техкарты, даже если некоторые не удалось сохранить
     */
    async saveRecipes(recipes: Recipe[]): Promise<number> {
        if (!supabase || recipes.length === 0) {
            console.warn('[RecipesService] No recipes to save or supabase not available');
            return 0;
        }

        console.log(`[RecipesService] Начинаем сохранение ${recipes.length} тех.карт в базу данных...`);
        let savedCount = 0;
        const errors: Array<{ recipe: Recipe; error: any }> = [];

        for (let i = 0; i < recipes.length; i++) {
            const recipe = recipes[i];
            try {
                console.log(`[RecipesService] Сохранение тех.карты ${i + 1}/${recipes.length}: "${recipe.name}" (ID: ${recipe.id})`);
                const success = await this.saveRecipe(recipe);
                if (success) {
                    savedCount++;
                    console.log(`[RecipesService] ✅ Тех.карта "${recipe.name}" сохранена успешно`);
                } else {
                    console.error(`[RecipesService] ❌ Не удалось сохранить тех.карту "${recipe.name}"`);
                    errors.push({ recipe, error: 'Save returned false' });
                }
            } catch (error) {
                console.error(`[RecipesService] ❌ Ошибка при сохранении тех.карты "${recipe.name}":`, error);
                errors.push({ recipe, error });
            }
        }

        console.log(`[RecipesService] === ИТОГИ СОХРАНЕНИЯ ===`);
        console.log(`[RecipesService] Сохранено: ${savedCount} из ${recipes.length} тех.карт`);
        if (errors.length > 0) {
            console.error(`[RecipesService] Ошибки при сохранении ${errors.length} тех.карт:`, errors);
        }

        return savedCount;
    },

    /**
     * Удалить техкарту из базы данных
     * ВАЖНО: Бэкап создается автоматически через триггер перед удалением
     */
    async deleteRecipe(recipeId: string, confirmDelete: boolean = false): Promise<boolean> {
        if (!supabase) {
            return false;
        }

        if (!confirmDelete) {
            console.warn('[RecipesService] Delete operation requires confirmation');
            return false;
        }

        try {
            // Проверяем, существует ли техкарта
            const { data: existing, error: checkError } = await supabase
                .from('recipes')
                .select('id, name')
                .eq('id', recipeId)
                .single();

            if (checkError || !existing) {
                console.error('[RecipesService] Recipe not found:', recipeId);
                return false;
            }

            console.log(`[RecipesService] Deleting recipe "${existing.name}" (${recipeId})...`);
            console.log(`[RecipesService] Backup will be created automatically by trigger`);

            // Ингредиенты удалятся автоматически (CASCADE)
            // Бэкап создастся автоматически через триггер BEFORE DELETE
            const { error } = await supabase
                .from('recipes')
                .delete()
                .eq('id', recipeId);

            if (error) {
                console.error('[RecipesService] Error deleting recipe:', error);
                return false;
            }

            console.log(`[RecipesService] Recipe ${recipeId} deleted successfully. Backup created.`);
            return true;
        } catch (error) {
            console.error('[RecipesService] Exception deleting recipe:', error);
            return false;
        }
    },

    /**
     * Создать ручной бэкап техкарты
     */
    async createManualBackup(recipeId: string, notes?: string): Promise<boolean> {
        if (!supabase) {
            return false;
        }

        try {
            // Получаем техкарту
            const { data: recipeData, error: recipeError } = await supabase
                .from('recipes')
                .select('*')
                .eq('id', recipeId)
                .single();

            if (recipeError || !recipeData) {
                console.error('[RecipesService] Error fetching recipe for backup:', recipeError);
                return false;
            }

            // Получаем ингредиенты
            const { data: ingredientsData, error: ingredientsError } = await supabase
                .from('recipe_ingredients')
                .select('*')
                .eq('recipe_id', recipeId);

            if (ingredientsError) {
                console.error('[RecipesService] Error fetching ingredients for backup:', ingredientsError);
            }

            // Создаем бэкап
            const { error: backupError } = await supabase
                .from('recipes_backup')
                .insert({
                    recipe_id: recipeId,
                    recipe_data: recipeData,
                    ingredients_data: ingredientsData || [],
                    backup_type: 'manual',
                    notes: notes || null
                });

            if (backupError) {
                console.error('[RecipesService] Error creating backup:', backupError);
                return false;
            }

            console.log(`[RecipesService] Manual backup created for recipe ${recipeId}`);
            return true;
        } catch (error) {
            console.error('[RecipesService] Exception creating backup:', error);
            return false;
        }
    }
};

