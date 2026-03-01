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
    _debugLoggedOnce: false,

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

            // Загружаем ингредиенты для всех техкарт (с пагинацией)
            const recipeIds = recipesData.map(r => r.id);
            let allIngredients: RecipeIngredientDB[] = [];
            const BATCH_SIZE = 1000;
            let from = 0;
            let hasMore = true;

            // Fetch ingredients in batches to bypass Supabase 1000 row limit
            // Note: .in('recipe_id', recipeIds) limits us, but if total result > 1000, we need range
            // BUT: range() works on the Result Set.
            console.log(`[RecipesService] Fetching ingredients for ${recipeIds.length} recipes...`);

            while (hasMore) {
                const { data, error } = await supabase
                    .from('recipe_ingredients')
                    .select('*')
                    .in('recipe_id', recipeIds)
                    .range(from, from + BATCH_SIZE - 1);

                if (error) {
                    console.error('[RecipesService] Error fetching ingredients batch:', error);
                    break;
                }

                if (data && data.length > 0) {
                    allIngredients = [...allIngredients, ...data];
                    from += BATCH_SIZE;
                    // If we got less than requested, we are done
                    if (data.length < BATCH_SIZE) {
                        hasMore = false;
                    }
                } else {
                    hasMore = false;
                }
            }

            const ingredientsData = allIngredients;
            console.log(`[RecipesService] Fetched total ${ingredientsData.length} ingredient rows (Batched).`);

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
    /**
     * Предварительно создает все недостающие материалы для списка техкарт.
     * Возвращает контекст разрешения { skuToIdMap, nameToIdMap }.
     */
    async ensureAllItemsExist(recipes: Recipe[]): Promise<{ skuToIdMap: Map<string, string>, nameToIdMap: Map<string, string> }> {
        if (!supabase) return { skuToIdMap: new Map(), nameToIdMap: new Map() };

        // 1. Сбор всех уникальных SKU и Имен
        const skuSet = new Set<string>();
        const nameSet = new Set<string>();
        const newItemsMap = new Map<string, { name: string, sku: string }>();

        recipes.forEach(recipe => {
            recipe.ingredients.forEach(ing => {
                const sku = ing.tempMaterial?.sku || ing.itemId.replace('temp-', '');
                const name = ing.tempMaterial?.name;

                // Если есть SKU, добавим в список проверки по SKU
                if (sku && sku.trim().length > 0 && !sku.includes('unknown') && !sku.includes('temp-')) {
                    skuSet.add(sku);
                }

                // Всегда добавим имя в список проверки по Имени (как фоллбэк)
                if (name && name.trim().length > 0) {
                    nameSet.add(name);
                }

                // Логика создания новых:
                // 1. Если есть SKU -> используем его.
                // 2. Если SKU нет, но есть Имя -> генерируем auto-SKU (чтобы создать связь).
                if (ing.itemId.startsWith('temp-')) {
                    let validSku = sku;

                    if (!validSku || validSku.length === 0) {
                        if (name && name.length > 0) {
                            // Generate stable SKU from name hash or simple slug
                            const slug = name.replace(/[^a-zA-Z0-9а-яА-Я]/g, '').slice(0, 10);
                            validSku = `auto-${slug}-${Math.floor(Math.random() * 1000)}`;
                            console.log(`[RecipesService] Generating Auto-SKU for "${name}": ${validSku}`);
                        }
                    }

                    if (validSku && validSku.trim().length > 0 && !validSku.includes('unknown')) {
                        if (!newItemsMap.has(validSku)) {
                            newItemsMap.set(validSku, { sku: validSku, name: name || `Material ${validSku}` });
                            // Don't add to skuSet if it's auto-generated (unlikely to exist in DB by SKU)
                            if (!validSku.startsWith('auto-')) {
                                skuSet.add(validSku);
                            }
                        }
                    }
                }
            });
        });

        const skuToIdMap = new Map<string, string>();
        const nameToIdMap = new Map<string, string>();

        // 2. Resolve by SKU
        const skusToCheck = Array.from(skuSet);
        const CHUNK_SIZE = 50;

        if (skusToCheck.length > 0) {
            console.log(`[RecipesService] Resolving ${skusToCheck.length} SKUs...`);
            for (let i = 0; i < skusToCheck.length; i += CHUNK_SIZE) {
                const chunk = skusToCheck.slice(i, i + CHUNK_SIZE);
                const { data: existingItems } = await supabase
                    .from('items')
                    .select('id, sku')
                    .in('sku', chunk);

                if (existingItems) {
                    existingItems.forEach(item => {
                        skuToIdMap.set(item.sku, item.id);
                    });
                }
            }
        }

        // 3. Resolve by Name (Fallback)
        // Only fetch names that weren't resolved by SKU? Or just fetch all unique names to be safe.
        // Fetching all might be heavy, but safest.
        const namesToCheck = Array.from(nameSet);
        if (namesToCheck.length > 0) {
            console.log(`[RecipesService] Resolving ${namesToCheck.length} Names (Fallback)...`);
            // Names can be long (Cyrillic + Special Chars), so Keep Chunk Size SMALL
            const NAME_CHUNK_SIZE = 10;

            for (let i = 0; i < namesToCheck.length; i += NAME_CHUNK_SIZE) {
                const chunk = namesToCheck.slice(i, i + NAME_CHUNK_SIZE);
                const { data, error } = await supabase.from('items').select('id, name').in('name', chunk);

                if (error) {
                    console.error('[RecipesService] Error resolving names chunk:', error);
                    // continue best effort
                }

                if (data) {
                    data.forEach(item => nameToIdMap.set(item.name, item.id));
                }
            }
        }

        // 4. Create Missing Items (Only if SKU exists)
        // Identify SKUs that are in newItemsMap but NOT in skuToIdMap
        const itemsToCreate = Array.from(newItemsMap.values())
            .filter(item => !skuToIdMap.has(item.sku));

        if (itemsToCreate.length > 0) {
            console.log(`[RecipesService] Creating ${itemsToCreate.length} missing items...`);
            // Creation logic ... (simplified for brevity, keeping existing)
            for (let i = 0; i < itemsToCreate.length; i += CHUNK_SIZE) {
                const chunk = itemsToCreate.map(item => ({
                    id: self.crypto.randomUUID(),
                    sku: item.sku,
                    name: item.name,
                    category: 'Сырье',
                    unit: 'kg',
                    min_stock_level: 0
                }));

                // Blind Insert
                const { error } = await supabase.from('items').insert(chunk);
                if (error) console.warn('[RecipesService] Blind insert warning:', error.message);
            }

            // Final Re-fetch for created items
            const skusToRefetch = itemsToCreate.map(i => i.sku);
            for (let i = 0; i < skusToRefetch.length; i += CHUNK_SIZE) {
                const chunk = skusToRefetch.slice(i, i + CHUNK_SIZE);
                const { data } = await supabase.from('items').select('id, sku, name').in('sku', chunk);
                if (data) {
                    data.forEach(item => {
                        skuToIdMap.set(item.sku, item.id);
                        if (item.name) {
                            nameToIdMap.set(item.name, item.id);
                        }
                    });
                }
            }
        }

        console.log(`[RecipesService] Resolution Stats: SKU matches=${skuToIdMap.size}, Name matches=${nameToIdMap.size}`);
        return { skuToIdMap, nameToIdMap };
    },

    /**
     * Сохранить одну техкарту (Внутренний метод, использует уже готовые ID)
     */
    /**
     * Сохранить одну техкарту (Внутренний метод, использует уже готовые ID)
     */
    async saveRecipeInternal(recipe: Recipe, resolution: { skuToIdMap: Map<string, string>, nameToIdMap: Map<string, string> }): Promise<boolean> {
        if (!supabase) return false;

        try {
            // 1. Подготовка данных рецепта ... (same)
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

            // 3. Подготовка ингредиентов с использованием resolution maps
            const ingredientsData: RecipeIngredientDB[] = [];

            if (recipe.ingredients) {
                recipe.ingredients.forEach(ing => {
                    let realItemId = ing.itemId;
                    const tempSku = ing.tempMaterial?.sku;

                    // Если это temp-ID, пробуем найти реальный UUID
                    if (ing.itemId.startsWith('temp-')) {
                        // Normalized lookup key: prioritize tempMaterial.sku, fallback to parsing ID
                        const rawSkuToCheck = tempSku || ing.itemId.replace('temp-', '');
                        const skuToCheck = rawSkuToCheck ? String(rawSkuToCheck).trim() : '';

                        // 1. Try SKU Lookup
                        let resolveId = resolution.skuToIdMap.get(skuToCheck);

                        // 2. Try Name Lookup (Fallback)
                        if (!resolveId) {
                            const nameToCheck = ing.tempMaterial?.name || '';
                            if (nameToCheck) {
                                resolveId = resolution.nameToIdMap.get(nameToCheck);
                                if (resolveId) {
                                    // Found by Name!
                                    // console.log(`[RecipesService] 🔦 Resolved item by Name: "${nameToCheck}" -> ${resolveId}`);
                                }
                            }
                        }

                        if (resolveId) {
                            realItemId = resolveId;
                        } else {
                            // VERBOSE DEBUG: Why is it missing?
                            if (!(this as Record<string, unknown>)._debugLoggedOnce) {
                                console.log('[RecipesService] DEBUG SKU LOOKUP FAIL:', {
                                    lookingForSku: skuToCheck,
                                    hasSku: resolution.skuToIdMap.has(skuToCheck),
                                    lookingForName: ing.tempMaterial?.name,
                                    hasName: resolution.nameToIdMap.has(ing.tempMaterial?.name || '')
                                });
                                (this as Record<string, unknown>)._debugLoggedOnce = true;
                            }

                            console.warn(`[RecipesService] ⚠️ Could not resolve SKU "${skuToCheck}" or Name "${ing.tempMaterial?.name}" for ingredient in "${recipe.name}". Skipping.`);
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
                            ? (ing.monthlyNorms as Array<{ date: string; quantity: number }>)
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

