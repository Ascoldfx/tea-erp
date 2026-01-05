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

            // PRE-FLIGHT: Auto-create any missing "temp" materials to ensure they have real IDs
            // This fixes the "Empty Tech Card" issue where DB rejects ingredients with NULL item_id
            const tempIngredients = recipe.ingredients?.filter(ing => ing.itemId.startsWith('temp-')) || [];

            if (tempIngredients.length > 0) {
                console.log(`[RecipesService] Found ${tempIngredients.length} temp ingredients. Auto-creating them as real items...`);

                const newItems = tempIngredients.map(ing => ({
                    sku: ing.tempMaterial?.sku || ing.itemId.replace('temp-', ''),
                    name: ing.tempMaterial?.name || `Material ${ing.itemId}`,
                    type: 'material',
                    category: 'Сырье', // Default category
                    unit: 'kg', // Default unit, user can change later
                    min_stock_level: 0
                }));

                // Upsert items based on SKU to get their IDs (or create if missing)
                const { data: createdItems, error: createError } = await supabase
                    .from('items')
                    .upsert(newItems, { onConflict: 'sku' })
                    .select('id, sku');

                if (createError) {
                    console.error('[RecipesService] Failed to auto-create items:', createError);
                    // We continue, but these might fail to save as ingredients
                } else if (createdItems) {
                    // Map the new real IDs back to the ingredients
                    const skuToIdMap = new Map(createdItems.map(item => [item.sku, item.id]));

                    recipe.ingredients = recipe.ingredients.map(ing => {
                        if (ing.itemId.startsWith('temp-')) {
                            const sku = ing.tempMaterial?.sku || ing.itemId.replace('temp-', '');
                            const realId = skuToIdMap.get(sku);
                            if (realId) {
                                return { ...ing, itemId: realId, tempMaterial: undefined };
                            }
                        }
                        return ing;
                    });
                    console.log(`[RecipesService] Successfully resolved ${createdItems.length} temp ingredients to real IDs`);
                }
            }

            const { error: recipeError } = await supabase
                .from('recipes')
                .upsert(recipeData, { onConflict: 'id' });

            if (recipeError) {
                console.error('[RecipesService] Error saving recipe:', recipeError);
                return false;
            }

            // Подготавливаем новые ингредиенты ПЕРЕД удалением старых
            // Это позволяет проверить, есть ли что сохранять, и избежать удаления данных если импорт пустой
            let ingredientsData: RecipeIngredientDB[] = [];

            if (recipe.ingredients && recipe.ingredients.length > 0) {
                // ВАЖНО: Фильтруем ингредиенты с временными ID (temp-...)
                const validIngredients = recipe.ingredients.filter(ing => {
                    // Пропускаем ингредиенты с временным ID, если нет tempMaterial
                    if (ing.itemId.startsWith('temp-') && !ing.tempMaterial) {
                        console.warn(`[RecipesService] [SAFEGUARD] Пропущен ингредиент с временным ID без tempMaterial: ${ing.itemId}`);
                        return false;
                    }
                    return true;
                });

                if (validIngredients.length > 0) {
                    // Группируем и подготавливаем данные
                    const ingredientsMap = new Map<string, RecipeIngredientDB>();

                    validIngredients.forEach(ing => {
                        const itemId = ing.itemId.startsWith('temp-') ? null : ing.itemId;
                        const uniqueKey = itemId ? `${recipe.id}_${itemId}` : `${recipe.id}_temp_${ing.itemId}`;
                        const tempSku = ing.tempMaterial?.sku || (ing.itemId.startsWith('temp-') ? ing.itemId.replace('temp-', '') : undefined);
                        const tempName = ing.tempMaterial?.name || undefined;

                        ingredientsMap.set(uniqueKey, {
                            recipe_id: recipe.id,
                            item_id: itemId,
                            quantity: ing.quantity,
                            tolerance: ing.tolerance || undefined,
                            is_duplicate_sku: ing.isDuplicateSku || false,
                            is_auto_created: ing.isAutoCreated || false,
                            temp_material_sku: tempSku,
                            temp_material_name: tempName,
                            monthly_norms: ing.monthlyNorms && Array.isArray(ing.monthlyNorms) && ing.monthlyNorms.length > 0
                                ? (ing.monthlyNorms as any)
                                : null
                        });
                    });

                    ingredientsData = Array.from(ingredientsMap.values());
                }
            }

            // БЛОКИРОВКА УДАЛЕНИЯ: Если нет валидных ингредиентов для сохранения, НЕ удаляем старые
            // Это защита от случайного стирания рецептов при ошибках парсинга
            if (ingredientsData.length === 0) {
                console.warn(`[RecipesService] ⚠️ Recipe "${recipe.name}" (${recipe.id}) has NO valid ingredients to save. Skipping DB update to prevent data loss.`);
                // Возвращаем true, чтобы не прерывать общий процесс (это "мягкая" ошибка)

                // VERIFICATION: Check if they actually exist
                const { count, error: verifyError } = await supabase
                    .from('recipe_ingredients')
                    .select('*', { count: 'exact', head: true })
                    .eq('recipe_id', recipe.id);

                if (verifyError) {
                    console.error(`[RecipesService] ❌ Verification failed for ${recipe.name}:`, verifyError);
                } else if (count !== ingredientsData.length) {
                    console.error(`[RecipesService] ❌ GHOST WRITE DETECTED for ${recipe.name}! Tried to save ${ingredientsData.length}, found ${count} in DB.`);
                } else {
                    // console.log(`[RecipesService] ✅ Verified: ${count} ingredients in DB for ${recipe.name}`);
                }

                return true;
            }

            // Если данные есть - удаляем старые и вставляем новые
            const { error: deleteError } = await supabase
                .from('recipe_ingredients')
                .delete()
                .eq('recipe_id', recipe.id);

            if (deleteError) {
                console.error('[RecipesService] Error deleting old ingredients:', deleteError);
                return false;
            }

            // Вставляем новые
            const { error: ingredientsError } = await supabase
                .from('recipe_ingredients')
                .insert(ingredientsData);

            if (ingredientsError) {
                console.error('[RecipesService] Error saving ingredients (BATCH):', JSON.stringify(ingredientsError, null, 2));

                // FALLBACK: Try saving one by one to isolate the error and save what we can
                console.log('[RecipesService] Retrying ingredients one-by-one to salvage valid data...');
                let savedCount = 0;

                for (const ing of ingredientsData) {
                    const { error: singleError } = await supabase
                        .from('recipe_ingredients')
                        .insert([ing]);

                    if (singleError) {
                        console.error(`[RecipesService] Failed to save ingredient ${ing.item_id || ing.temp_material_name}:`, JSON.stringify(singleError, null, 2));
                        if (savedCount === 0) {
                            // ALERT USER ON FIRST FAILURE
                            window.alert(`DB ERROR: Failed to save ingredient!\n\nReason: ${singleError.message}\nDetails: ${singleError.details}\n\nThis confirms the database is rejecting the data.`);
                        }
                    } else {
                        savedCount++;
                    }
                }

                if (savedCount > 0) {
                    console.log(`[RecipesService] Successfully recovered ${savedCount} of ${ingredientsData.length} ingredients.`);
                    return true; // Consider success if we saved something
                }

                return false;
            }

            // console.log(`[RecipesService] ✅ Перезаписано ${ insertedIngredients?.length || 0 } ингредиентов для тех.карты "${recipe.name}"(${ validCount } valid, ${ tempCount } temp)`);


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
                // console.log(`[RecipesService] Сохранение тех.карты ${ i + 1}/${recipes.length}: "${recipe.name}" (ID: ${recipe.id})`);
                const success = await this.saveRecipe(recipe);
                if (success) {
                    savedCount++;
                    // console.log(`[RecipesService] ✅ Тех.карта "${recipe.name}" сохранена успешно`);
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

