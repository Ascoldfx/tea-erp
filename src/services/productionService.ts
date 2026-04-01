import { supabase } from '../lib/supabase';
import type { ProductionBatch, Recipe } from '../types/production';

/** Helper: resolve the norm for a specific year-month from a recipe ingredient */
function getNormForMonth(
    ingredient: Recipe['ingredients'][0],
    year: number,
    month: number // 0-indexed (January = 0)
): number {
    if (!ingredient.monthlyNorms || ingredient.monthlyNorms.length === 0) {
        return ingredient.quantity;
    }
    const targetYearMonth = `${year}-${String(month + 1).padStart(2, '0')}`;
    const norm = ingredient.monthlyNorms.find(n => n.date.startsWith(targetYearMonth));
    return norm?.quantity ?? ingredient.quantity;
}

/** Helper: parse a YYYY-MM-DD date string into { year, month (0-indexed) } */
function parseDateParts(dateStr: string): { year: number; month: number } {
    const [year, month] = dateStr.split('-').map(Number);
    return { year, month: month - 1 };
}

/** Type for the ingredient snapshot stored in batch metadata */
interface IngredientSnapshot {
    itemId: string;
    quantity: number; // reserved quantity added to planned_consumption
    plannedDate: string; // YYYY-MM-01
}

function mapBatchRow(b: Record<string, unknown>): ProductionBatch {
    return {
        id: b.id as string,
        recipeId: b.recipe_id as string,
        status: b.status as ProductionBatch['status'],
        startDate: b.start_date as string | undefined,
        endDate: b.end_date as string | undefined,
        targetQuantity: Number(b.target_quantity),
        producedQuantity: b.produced_quantity != null ? Number(b.produced_quantity) : undefined,
        materialsHandoverDate: b.materials_handover_date as string | undefined,
        materialsAcceptedDate: b.materials_accepted_date as string | undefined,
        machineId: b.machine_id as string | undefined,
    };
}

export const productionService = {
    async getBatches(): Promise<ProductionBatch[]> {
        if (!supabase) return [];

        const { data, error } = await supabase
            .from('production_batches')
            .select('*')
            .order('start_date', { ascending: true });

        if (error) {
            console.error('Error fetching production batches:', error);
            throw new Error('Ошибка при загрузке партий производства');
        }

        return (data || []).map(mapBatchRow);
    },

    /**
     * Создать производственную партию и зарезервировать сырьё в planned_consumption.
     * @param batch  - данные партии (targetQuantity здесь = кол-во пачек, после пересчёта из КГ)
     * @param recipe - (необязательно) рецепт с ингредиентами для резервирования
     */
    async createBatch(batch: Omit<ProductionBatch, 'id'>, recipe?: Recipe): Promise<ProductionBatch> {
        if (!supabase) throw new Error('База данных не подключена');

        // 1. Создаём запись партии
        const { data, error } = await supabase
            .from('production_batches')
            .insert({
                recipe_id: batch.recipeId,
                status: batch.status,
                start_date: batch.startDate,
                end_date: batch.endDate,
                target_quantity: batch.targetQuantity,
                produced_quantity: batch.producedQuantity ?? null,
                materials_handover_date: batch.materialsHandoverDate ?? null,
                materials_accepted_date: batch.materialsAcceptedDate ?? null,
                machine_id: batch.machineId ?? null,
            })
            .select()
            .single();

        if (error) throw new Error('Ошибка при планировании партии: ' + error.message);

        const createdBatch = mapBatchRow(data as Record<string, unknown>);

        // 2. Резервируем сырьё в planned_consumption (если рецепт передан)
        if (recipe && recipe.ingredients.length > 0 && batch.startDate) {
            const { year, month } = parseDateParts(batch.startDate);
            const plannedDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
            const snapshot: IngredientSnapshot[] = [];

            for (const ingredient of recipe.ingredients) {
                // Пропускаем "временные" ингредиенты без реального item_id
                if (ingredient.itemId.startsWith('temp-')) continue;

                // Норма для конкретного месяца (или базовая)
                const normPerPack = getNormForMonth(ingredient, year, month);
                // targetQuantity в БД = кол-во пачек
                const reserved = createdBatch.targetQuantity * normPerPack;
                if (reserved <= 0) continue;

                // Читаем текущий плановый расход (чтобы суммировать, а не перезаписывать)
                const { data: existing } = await supabase
                    .from('planned_consumption')
                    .select('quantity')
                    .eq('item_id', ingredient.itemId)
                    .eq('planned_date', plannedDate)
                    .maybeSingle();

                const existingQty = existing?.quantity ?? 0;
                const newQty = existingQty + reserved;

                await supabase
                    .from('planned_consumption')
                    .upsert(
                        { item_id: ingredient.itemId, planned_date: plannedDate, quantity: newQty },
                        { onConflict: 'item_id,planned_date' }
                    );

                snapshot.push({ itemId: ingredient.itemId, quantity: reserved, plannedDate });
            }

            // 3. Сохраняем снапшот в metadata партии (чтобы потом точно вычесть)
            if (snapshot.length > 0) {
                await supabase
                    .from('production_batches')
                    .update({ metadata: { ingredientsSnapshot: snapshot } })
                    .eq('id', createdBatch.id);

                console.log(
                    `[productionService] Reserved ${snapshot.length} ingredients for batch ${createdBatch.id}`
                );
            }
        }

        return createdBatch;
    },

    /**
     * Удалить партию и отменить резервирование сырья (используя снапшот из metadata).
     */
    async deleteBatch(id: string): Promise<void> {
        if (!supabase) throw new Error('База данных не подключена');

        // Читаем партию вместе с metadata
        const { data: batchData, error: fetchError } = await supabase
            .from('production_batches')
            .select('metadata')
            .eq('id', id)
            .single();

        if (fetchError) throw new Error('Ошибка при получении данных партии: ' + fetchError.message);

        // Если есть снапшот — вычитаем расход из planned_consumption
        const snapshot: IngredientSnapshot[] =
            (batchData?.metadata as { ingredientsSnapshot?: IngredientSnapshot[] } | null)
                ?.ingredientsSnapshot ?? [];

        for (const item of snapshot) {
            const { data: existing } = await supabase
                .from('planned_consumption')
                .select('quantity')
                .eq('item_id', item.itemId)
                .eq('planned_date', item.plannedDate)
                .maybeSingle();

            if (existing) {
                const newQty = Math.max(0, (existing.quantity ?? 0) - item.quantity);
                await supabase
                    .from('planned_consumption')
                    .update({ quantity: newQty })
                    .eq('item_id', item.itemId)
                    .eq('planned_date', item.plannedDate);
            }
        }

        // Удаляем саму партию
        const { error: deleteError } = await supabase
            .from('production_batches')
            .delete()
            .eq('id', id);

        if (deleteError) throw new Error('Ошибка при удалении партии: ' + deleteError.message);

        console.log(`[productionService] Batch ${id} deleted, ${snapshot.length} reservations reversed.`);
    },

    async updateBatch(id: string, updates: Partial<ProductionBatch>): Promise<ProductionBatch> {
        if (!supabase) throw new Error('База данных не подключена');

        const dbUpdates: Record<string, unknown> = {};
        if (updates.recipeId !== undefined) dbUpdates.recipe_id = updates.recipeId;
        if (updates.status !== undefined) dbUpdates.status = updates.status;
        if (updates.startDate !== undefined) dbUpdates.start_date = updates.startDate;
        if (updates.endDate !== undefined) dbUpdates.end_date = updates.endDate;
        if (updates.targetQuantity !== undefined) dbUpdates.target_quantity = updates.targetQuantity;
        if (updates.producedQuantity !== undefined) dbUpdates.produced_quantity = updates.producedQuantity;
        if (updates.materialsHandoverDate !== undefined) dbUpdates.materials_handover_date = updates.materialsHandoverDate;
        if (updates.materialsAcceptedDate !== undefined) dbUpdates.materials_accepted_date = updates.materialsAcceptedDate;
        if (updates.machineId !== undefined) dbUpdates.machine_id = updates.machineId;

        const { data, error } = await supabase
            .from('production_batches')
            .update(dbUpdates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw new Error('Ошибка при обновлении партии: ' + error.message);

        return mapBatchRow(data as Record<string, unknown>);
    },
};
