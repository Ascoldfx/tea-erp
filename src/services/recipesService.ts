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
            } else {
                console.log(`[RecipesService] Fetched total ${ingredientsData?.length || 0} ingredient rows for ${recipesData.length} recipes.`);
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

                // DEBUG: Log distribution
                const zeroIngs = recipesData.filter(r => !ingredientsMap.has(r.id) || ingredientsMap.get(r.id)!.length === 0);
                const someIngs = recipesData.filter(r => ingredientsMap.has(r.id) && ingredientsMap.get(r.id)!.length > 0);
                console.log(`[RecipesService] DEBUG: ${someIngs.length} recipes have ingredients, ${zeroIngs.length} recipes have ZERO ingredients.`);
                if (zeroIngs.length > 0) {
                    console.log('[RecipesService] Sample EMPTY recipes:', zeroIngs.slice(0, 3).map(r => `${r.name} (${r.id})`));
                }
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
     * Предварительно создает все недостающие материалы для списка техкарт.
     * Возвращает Map<SKU, UUID> для всех материалов.
     */
    async ensureAllItemsExist(recipes: Recipe[]): Promise<Map<string, string>> {
        if (!supabase) return new Map();

        // 1. Сбор всех уникальных SKU, которые требуют проверки (temp-*)
        const skuSet = new Set<string>();
        const newItemsMap = new Map<string, { name: string, sku: string }>();

        recipes.forEach(recipe => {
            recipe.ingredients.forEach(ing => {
                if (ing.itemId.startsWith('temp-')) {
                    const sku = ing.tempMaterial?.sku || ing.itemId.replace('temp-', '');
                    const name = ing.tempMaterial?.name || `Material ${ing.itemId}`;
                    skuSet.add(sku);
                    newItemsMap.set(sku, { sku, name });
                }
            });
        });

        if (skuSet.size === 0) {
            return new Map();
        }

        console.log(`[RecipesService] Bulk Resolve: Checking ${skuSet.size} potential new items...`);
        const skusToCheck = Array.from(skuSet);
        const skuToIdMap = new Map<string, string>();

        // 2. Проверяем, какие уже есть в базе
        // Разбиваем на чанки по 100, чтобы не превысить лимиты URL
        const CHUNK_SIZE = 100;
        const existingSkus = new Set<string>();

        for (let i = 0; i < skusToCheck.length; i += CHUNK_SIZE) {
            const chunk = skusToCheck.slice(i, i + CHUNK_SIZE);
            const { data: existingItems, error } = await supabase
                .from('items')
                .select('id, sku')
                .in('sku', chunk);

            if (error) {
                console.error('[RecipesService] Error checking existing items:', error);
                continue;
            }

            if (existingItems) {
                existingItems.forEach(item => {
                    existingSkus.add(item.sku);
                    skuToIdMap.set(item.sku, item.id);
                });
            }
        }

        // 3. Определяем, что реально нужно создать
        const itemsToCreate = skusToCheck
            .filter(sku => {
                // STRICT VALIDATION: Ignore empty or "unknown" SKUs to comply with user request
                if (!sku || sku.trim() === '' || sku.toLowerCase().includes('unknown')) {
                    console.warn(`[RecipesService] Skipping invalid SKU during auto-create: "${sku}"`);
                    return false;
                }
                return !existingSkus.has(sku);
            })
            .map(sku => {
                // Use Name from Excel if available, otherwise fallback to SKU
                // User Request: "Don't assign own indexes". We avoid "Material temp-..." names.
                const originalName = newItemsMap.get(sku)?.name;
                const finalName = originalName && originalName.trim() !== ''
                    ? originalName
                    : `Материал ${sku}`; // Clean fallback

                return {
                    sku: sku,
                    name: finalName,
                    category: 'Сырье',
                    unit: 'kg',
                    min_stock_level: 0
                };
            });

        if (itemsToCreate.length === 0) {
            console.log('[RecipesService] All items already exist.');
            return skuToIdMap;
        }

        // 4. Создаем недостающие (Batch Insert with Fallback)
        console.log(`[RecipesService] Creating ${itemsToCreate.length} missing items...`);

        const NEW_CHUNK_SIZE = 50; // Smaller chunk size for safety

        for (let i = 0; i < itemsToCreate.length; i += NEW_CHUNK_SIZE) {
            const chunk = itemsToCreate.slice(i, i + NEW_CHUNK_SIZE);

            try {
                // Пытаемся вставить пачкой (без select, чтобы избежать проблем с RLS/Permissions)
                const { error: batchError } = await supabase
                    .from('items')
                    .insert(chunk);

                if (batchError) {
                    throw batchError; // Переходим к поштучной вставке
                }
            } catch (batchErr) {
                console.warn('[RecipesService] Batch insert failed, switching to single-item mode:', batchErr);

                // Fallback: поштучная вставка
                for (const item of chunk) {
                    try {
                        const { error: singleError } = await supabase
                            .from('items')
                            .insert([item]);

                        if (singleError) {
                            console.error(`[RecipesService] Failed to create item ${item.sku}:`, singleError.message);
                        }
                    } catch (e) {
                        console.error(`[RecipesService] Exception creating item ${item.sku}:`, e);
                    }
                }
            }
        }

        // 5. FINAL RE-FETCH (The Source of Truth)
        // Независимо от того, как прошла вставка, запрашиваем IDs для ВСЕХ SKU
        // Это гарантирует, что у нас будут валидные ID для всего, что есть в базе
        console.log('[RecipesService] Re-fetching all IDs after creation...');

        for (let i = 0; i < skusToCheck.length; i += NEW_CHUNK_SIZE) { // Use NEW_CHUNK_SIZE for consistency
            const chunk = skusToCheck.slice(i, i + NEW_CHUNK_SIZE);
            const { data: finalItems, error: finalError } = await supabase
                .from('items')
                .select('id, sku')
                .in('sku', chunk);

            if (finalError) {
                console.error('[RecipesService] CRITICAL: Failed to re-fetch items:', finalError);
            } else if (finalItems) {
                finalItems.forEach(item => {
                    skuToIdMap.set(item.sku, item.id);
                });
            }
        }

        console.log(`[RecipesService] Item resolution complete. Resolved ${skuToIdMap.size} SKUs.`);
        return skuToIdMap;
    },

    /**
     * Сохранить одну техкарту (Внутренний метод, использует уже готовые ID)
     */
    async saveRecipeInternal(recipe: Recipe, resolvedSkus: Map<string, string>): Promise<boolean> {
        if (!supabase) return false;

        try {
            // 1. Подготовка данных рецепта
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

            // 2. Сохранение самого рецепта
            const { error: recipeError } = await supabase
                .from('recipes')
                .upsert(recipeData, { onConflict: 'id' });

            if (recipeError) {
                console.error(`[RecipesService] Error saving recipe header ${recipe.name}:`, recipeError);
                return false;
            }

            // 3. Подготовка ингредиентов с использованием resolvedSkus
            const ingredientsData: RecipeIngredientDB[] = [];

            if (recipe.ingredients) {
                recipe.ingredients.forEach(ing => {
                    let realItemId = ing.itemId;
                    let tempSku = ing.tempMaterial?.sku;

                    // Если это temp-ID, пробуем найти реальный UUID
                    if (ing.itemId.startsWith('temp-')) {
                        const skuToCheck = tempSku || ing.itemId.replace('temp-', '');
                        const resolveId = resolvedSkus.get(skuToCheck);
                        if (resolveId) {
                            realItemId = resolveId;
                        } else {
                            console.warn(`[RecipesService] ⚠️ Could not resolve SKU ${skuToCheck} for ingredient in ${recipe.name}. Skipping.`);
                            return; // SKIP this ingredient
                        }
                    }

                    // Если все равно остался temp-, значит не нашли
                    if (realItemId.startsWith('temp-')) {
                        console.warn(`[RecipesService] ⚠️ Skipping unresolved ingredient ${realItemId}`);
                        return;
                    }

                    ingredientsData.push({
                        recipe_id: recipe.id,
                        item_id: realItemId,
                        quantity: ing.quantity,
                        tolerance: ing.tolerance || undefined,
                        is_duplicate_sku: ing.isDuplicateSku || false,
                        is_auto_created: ing.isAutoCreated || false,
                        temp_material_sku: tempSku,
                        temp_material_name: ing.tempMaterial?.name,
                        monthly_norms: ing.monthlyNorms && Array.isArray(ing.monthlyNorms) && ing.monthlyNorms.length > 0
                            ? (ing.monthlyNorms as any)
                            : null
                    });
                });
            }

            // 4. Перезапись ингредиентов (Delete + Insert)
            if (ingredientsData.length === 0) {
                console.warn(`[RecipesService] Recipe ${recipe.name} has no valid ingredients to save.`);
                return true; // Technically success (header saved)
            }

            const { error: deleteError } = await supabase
                .from('recipe_ingredients')
                .delete()
                .eq('recipe_id', recipe.id);

            if (deleteError) {
                console.error('[RecipesService] Error clearing old ingredients:', deleteError);
                return false;
            }

            const { error: insertError } = await supabase
                .from('recipe_ingredients')
                .insert(ingredientsData);

            if (insertError) {
                console.error('[RecipesService] Error saving ingredients:', insertError);
                return false;
            }

            return true;
        } catch (e) {
            console.error('[RecipesService] Exception in saveRecipeInternal:', e);
            return false;
        }
    },

    /**
     * Основной метод сохранения: сначала создает все материалы, потом сохраняет рецепты
     */
    async saveRecipes(recipes: Recipe[]): Promise<number> {
        if (!supabase || recipes.length === 0) return 0;

        try {
            console.log(`[RecipesService] Starting transactional save for ${recipes.length} recipes...`);

            // PHASE 1: Bulk Ensure Items
            const resolvedMap = await this.ensureAllItemsExist(recipes);

            // PHASE 2: Save Recipes using the map
            let savedCount = 0;
            for (const recipe of recipes) {
                const success = await this.saveRecipeInternal(recipe, resolvedMap);
                if (success) savedCount++;
            }

            console.log(`[RecipesService] Import completed. Saved ${savedCount}/${recipes.length} recipes.`);
            return savedCount;

        } catch (e) {
            console.error('[RecipesService] Critical error in saveRecipes:', e);
            return 0;
        }
    },

    // Legacy method wrapper for backward compatibility if needed, 
    // though ideally UI should call saveRecipes([recipe])
    async saveRecipe(recipe: Recipe): Promise<boolean> {
        return (await this.saveRecipes([recipe])) === 1;
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

