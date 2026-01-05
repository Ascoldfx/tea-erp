import { supabase } from '../lib/supabase';
import type { InventoryItem, StockLevel, Warehouse, PlannedConsumption } from '../types/inventory';

export const inventoryService = {
    async getItems(): Promise<InventoryItem[]> {
        if (!supabase) return [];

        let allItems: any[] = [];
        const BATCH_SIZE = 1000;
        let from = 0;
        let hasMore = true;

        // Fetch items in batches to bypass Supabase 1000 row limit
        while (hasMore) {
            const { data, error } = await supabase
                .from('items')
                .select('*')
                .range(from, from + BATCH_SIZE - 1);

            if (error) {
                console.error('Error fetching items batch:', error);
                break;
            }

            if (data && data.length > 0) {
                allItems = [...allItems, ...data];
                from += BATCH_SIZE;
                if (data.length < BATCH_SIZE) {
                    hasMore = false;
                }
            } else {
                hasMore = false;
            }
        }

        // Map database columns to TypeScript interface
        return allItems.map((item: any) => ({
            ...item,
            // Map other snake_case fields if needed
        })) as InventoryItem[];
    },

    async getWarehouses(): Promise<Warehouse[]> {
        if (!supabase) return [];

        const { data, error } = await supabase.from('warehouses').select('*');
        if (error) return [];

        // Ensure wh-ts warehouse is always named "ТС" instead of "Май"
        const warehouses = (data as Warehouse[]).map(w => {
            if (w.id === 'wh-ts') {
                return {
                    ...w,
                    name: 'ТС',
                    location: 'ТС'
                };
            }
            return w;
        });

        return warehouses;
    },

    async getStockLevels(): Promise<StockLevel[]> {
        if (!supabase) return [];

        let allStock: any[] = [];
        const BATCH_SIZE = 1000;
        let from = 0;
        let hasMore = true;

        while (hasMore) {
            const { data, error } = await supabase
                .from('stock_levels')
                .select('*')
                .range(from, from + BATCH_SIZE - 1);

            if (error) {
                console.error('Error fetching stock levels batch:', error);
                break;
            }

            if (data && data.length > 0) {
                allStock = [...allStock, ...data];
                from += BATCH_SIZE;
                if (data.length < BATCH_SIZE) {
                    hasMore = false;
                }
            } else {
                hasMore = false;
            }
        }

        // Map snake_case DB columns to camelCase TS interface
        return allStock.map((s: any) => ({
            id: s.id,
            warehouseId: s.warehouse_id,
            itemId: s.item_id,
            quantity: s.quantity,
            lastUpdated: s.updated_at
        })) as StockLevel[];
    },

    // Example of a mutation
    async transferStock(_sourceId: string, _targetId: string, _itemId: string, _qty: number) {
        if (!supabase) {
            return false;
        }

        // In reality, this would be a Postgres RPC call to ensure transaction safety
        // For MVP, we'll just log
        console.warn('Real DB Transfer not yet implemented (Requires Store Procedures)');
        return true;
    },

    async importData(items: any[]) {
        if (!supabase) {
            console.error('Supabase not connected');
            throw new Error('База данных не подключена');
        }

        if (!items || items.length === 0) {
            throw new Error('Нет данных для импорта');
        }

        console.log(`Начинаем импорт ${items.length} позиций...`);

        // 1. Get ALL existing items to resolve by SKU AND Name (to catch auto-created items)
        // We need this because Recipe Import might have created items with "auto-..." SKUs
        // but the Stock Import file might only have the Name.
        console.log('[Import] Fetching all existing items for robust resolution...');
        let allExistingItems: any[] = [];
        let from = 0;
        let hasMore = true;
        const BATCH_SIZE = 1000;

        while (hasMore) {
            const { data, error } = await supabase
                .from('items')
                .select('id, sku, name, category')
                .range(from, from + BATCH_SIZE - 1);

            if (error) {
                console.error('[Import] Error fetching existing items batch:', error);
                throw new Error(`Ошибка при загрузке справочника материалов: ${error.message}`);
            }

            if (data && data.length > 0) {
                allExistingItems = [...allExistingItems, ...data];
                from += BATCH_SIZE;
                if (data.length < BATCH_SIZE) hasMore = false;
            } else {
                hasMore = false;
            }
        }

        // Create match maps
        const skuToIdMap = new Map<string, string>();
        const nameToIdMap = new Map<string, string>(); // New: for Name-based fallback
        // Key by ID for reliable lookup after resolution
        const existingItemsMap = new Map<string, { id: string; name: string; category: string; sku: string }>();

        allExistingItems.forEach(item => {
            if (item.sku) skuToIdMap.set(item.sku, item.id);
            if (item.name) {
                // Clean name for better matching: lowercase, trim
                const cleanName = item.name.trim().toLowerCase();
                nameToIdMap.set(cleanName, item.id);
            }
            existingItemsMap.set(item.id, {
                id: item.id,
                name: item.name || '',
                category: item.category || 'other',
                sku: item.sku || ''
            });
        });

        console.log(`[Import] Found ${existingItemsMap.size} existing items that may be updated`);

        // 2. Prepare items for upsert
        // Strategy: Use code as ID if it's valid, otherwise generate UUID
        // If item with same SKU exists, use its existing ID
        // IMPORTANT: Remove duplicates by ID to avoid PostgreSQL error
        const itemsMap = new Map<string, any>();

        items.forEach(i => {
            const code = i.code?.trim();
            if (!code) {
                console.warn(`Пропущен материал без кода: ${i.name || 'Неизвестный'}`);
                return;
            }

            // Check if we have existing item with this SKU
            let itemId = skuToIdMap.get(code);

            // NEW: Fallback to Name Resolution if SKU not found
            if (!itemId) {
                const cleanName = (i.name || '').trim().toLowerCase();
                if (cleanName && nameToIdMap.has(cleanName)) {
                    itemId = nameToIdMap.get(cleanName);
                    console.log(`[Import] Resolved item by Name: "${i.name}" -> ID: ${itemId} (Excel Code: ${code} ignored/updated)`);
                }
            }

            // If not found, use code as ID (assuming code is valid text identifier)
            if (!itemId) {
                itemId = code; // Use code as ID (items.id is TEXT, so this should work)
            }

            // Ensure itemId is defined (TypeScript check)
            if (!itemId) {
                console.warn(`Не удалось определить ID для материала: ${i.name || 'Неизвестный'}, код: ${code}`);
                return;
            }

            // If we already have this ID, keep the last one (or you could merge data)
            // This removes duplicates before upsert
            // IMPORTANT: Always use the category from the current import to ensure correct grouping
            // This ensures that new imports take priority and clarify/update existing data
            const category = i.category || 'other';

            // Check if this is an update to existing material
            // NOTE: existingItemsMap is now keyed by ID
            const existingItem = existingItemsMap.get(itemId);
            if (existingItem) {
                const isCategoryChange = existingItem.category !== category;
                const isNameChange = existingItem.name !== (i.name?.trim() || 'Без названия');

                if (isCategoryChange || isNameChange) {
                    console.log(`[Import] Updating existing material: ${code} (${existingItem.name})`);
                    if (isCategoryChange) {
                        console.log(`[Import] Category change: ${existingItem.category} -> ${category}`);
                    }
                    if (isNameChange) {
                        console.log(`[Import] Name change: "${existingItem.name}" -> "${i.name?.trim() || 'Без названия'}"`);
                    }
                } else {
                    console.log(`[Import] Updating existing material: ${code} (${existingItem.name}) - same category and name`);
                }
            } else {
                console.log(`[Import] New material: ${code} (${i.name?.trim() || 'Без названия'}) - category: ${category}`);
            }

            if (category === 'flavor') {
                console.log(`[Category Debug] Material "${i.name}" assigned to flavor category`);
            }
            if (category === 'packaging_cardboard') {
                console.log(`[Category Debug] Material "${i.name}" assigned to packaging_cardboard category`);
            }

            // Normalize unit: convert pcs to шт
            let normalizedUnit = i.unit || 'шт';
            if (normalizedUnit.toLowerCase() === 'pcs') {
                normalizedUnit = 'шт';
            }

            // IMPORTANT: Always use the category from the NEW import (priority to new data)
            itemsMap.set(itemId, {
                id: itemId,
                sku: code,
                name: i.name?.trim() || 'Без названия',
                category: category, // Always use the category from import (new data takes priority)
                unit: normalizedUnit,
                min_stock_level: 0,
                storage_location: i.storageLocation || null
            });
        });

        // Convert map to array (removes duplicates)
        const dbItems = Array.from(itemsMap.values());

        const duplicatesCount = items.length - dbItems.length;
        if (duplicatesCount > 0) {
            console.warn(`Обнаружено ${duplicatesCount} дубликатов по коду. Будут импортированы только уникальные записи.`);
        }

        console.log(`Подготовлено ${dbItems.length} уникальных материалов для импорта (из ${items.length} строк)`);

        // Debug: log category distribution
        const categoryCounts = dbItems.reduce((acc, item) => {
            acc[item.category] = (acc[item.category] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
        console.log('[Category Debug] Category distribution:', categoryCounts);
        if (categoryCounts['flavor']) {
            console.log(`[Category Debug] Found ${categoryCounts['flavor']} items with flavor category`);
        }

        // 3. Upsert items (onConflict: 'id' means update if exists, insert if not)
        // IMPORTANT: Always update category to ensure correct grouping
        // Supabase upsert updates ALL fields by default, so category will be updated
        // IMPORTANT: Do not use .select() after upsert to avoid potential field errors
        const { error: itemsError } = await supabase
            .from('items')
            .upsert(dbItems, {
                onConflict: 'id',
                ignoreDuplicates: false
            });

        if (itemsError) {
            console.error('Error upserting items:', itemsError);
            throw new Error(`Ошибка при сохранении материалов: ${itemsError.message}`);
        }

        console.log(`Успешно сохранено/обновлено ${dbItems.length} материалов`);

        // CRITICAL: Refresh skuToIdMap after items are saved to include newly created items
        // This ensures planned consumption can be linked to the correct item IDs
        dbItems.forEach(item => {
            if (item.sku) {
                skuToIdMap.set(item.sku, item.id);
            }
        });
        console.log(`[Import] Refreshed skuToIdMap after items save: ${skuToIdMap.size} items mapped`);

        // Debug: verify categories were saved correctly by fetching from DB
        const itemIds = dbItems.map(item => item.id);
        const { data: savedItems, error: categoryFetchError } = await supabase
            .from('items')
            .select('id, sku, name, category')
            .in('id', itemIds);

        if (categoryFetchError) {
            console.error('Error fetching saved items for category verification:', categoryFetchError);
        } else if (savedItems && savedItems.length > 0) {
            const savedCategoryCounts = savedItems.reduce((acc: Record<string, number>, item: any) => {
                acc[item.category] = (acc[item.category] || 0) + 1;
                return acc;
            }, {} as Record<string, number>);
            console.log('[Category Debug] Saved category distribution (from DB):', savedCategoryCounts);

            // Log flavor items specifically
            if (savedCategoryCounts['flavor']) {
                console.log(`[Category Debug] Successfully saved ${savedCategoryCounts['flavor']} items with flavor category`);
                const flavorItems = savedItems.filter((item: any) => item.category === 'flavor');
                flavorItems.forEach((item: any) => {
                    console.log(`[Category Debug] Material "${item.name}" (SKU: ${item.sku}) has category: ${item.category}`);
                });
            }

            // Log sticker items specifically
            if (savedCategoryCounts['sticker']) {
                console.log(`[Category Debug] Successfully saved ${savedCategoryCounts['sticker']} items with sticker category`);
                const stickerItems = savedItems.filter((item: any) => item.category === 'sticker');
                stickerItems.forEach((item: any) => {
                    console.log(`[Category Debug] Material "${item.name}" (SKU: ${item.sku}) has category: ${item.category}`);
                });
            }
        }

        // 4. Prepare stock levels
        // Group stock by item_id and warehouse_id to avoid duplicates
        // If same item appears multiple times, sum the quantities
        const stockMap = new Map<string, { item_id: string; warehouse_id: string; quantity: number }>();

        // Get item categories to check if it's cardboard packaging
        const itemCategories = new Map<string, string>();
        for (const item of items) {
            const code = item.code?.trim();
            if (!code) continue;
            const itemId = skuToIdMap.get(code) || code;
            itemCategories.set(itemId, item.category || 'other');
        }

        for (const item of items) {
            const code = item.code?.trim();
            if (!code) continue;

            // Get the item ID (either from map or use code)
            const itemId = skuToIdMap.get(code) || code;

            // Main warehouse stock (Коцюбинське / база) - основной склад
            const mainKey = `${itemId}_wh-kotsyubinske`;
            const mainQty = Number(item.stockMain) || 0;
            if (mainQty > 0) {
                stockMap.set(mainKey, {
                    item_id: itemId,
                    warehouse_id: 'wh-kotsyubinske',
                    quantity: mainQty
                });
            }

            // Остатки на складах подрядчиков из stockWarehouses
            // Поддержка нового формата (stockWarehouses) и старого (stockMai, stockFito) для обратной совместимости
            if (item.stockWarehouses && typeof item.stockWarehouses === 'object') {
                // Новый формат: stockWarehouses - объект с ключами warehouse_id
                for (const [warehouseId, quantity] of Object.entries(item.stockWarehouses)) {
                    const qty = Number(quantity) || 0;
                    if (qty > 0) {
                        const key = `${itemId}_${warehouseId}`;
                        stockMap.set(key, {
                            item_id: itemId,
                            warehouse_id: warehouseId,
                            quantity: qty
                        });
                    }
                }
            } else {
                // Старый формат: stockMai и stockFito (для обратной совместимости)
                const maiQty = Number((item as any).stockMai) || 0;
                if (maiQty > 0) {
                    const maiKey = `${itemId}_wh-ts`;
                    stockMap.set(maiKey, {
                        item_id: itemId,
                        warehouse_id: 'wh-ts',
                        quantity: maiQty
                    });
                }

                const fitoQty = Number((item as any).stockFito) || 0;
                if (fitoQty > 0) {
                    const fitoKey = `${itemId}_wh-fito`;
                    stockMap.set(fitoKey, {
                        item_id: itemId,
                        warehouse_id: 'wh-fito',
                        quantity: fitoQty
                    });
                }
            }
        }

        const stockInserts = Array.from(stockMap.values());

        // 5. Upsert stock levels
        if (stockInserts.length > 0) {
            console.log(`Обновляем остатки для ${stockInserts.length} записей...`);
            const { error: stockError } = await supabase
                .from('stock_levels')
                .upsert(stockInserts, { onConflict: 'item_id,warehouse_id' });

            if (stockError) {
                console.error('Error upserting stock levels:', stockError);
                throw new Error(`Ошибка при сохранении остатков: ${stockError.message}`);
            }
            console.log('Остатки успешно обновлены');
        }

        // 6. Import planned consumption
        // COMPLETELY REWRITTEN: Use ONLY UUID from database, refresh map after items are saved
        const plannedConsumptionMap = new Map<string, {
            item_id: string;
            planned_date: string;
            quantity: number;
            notes?: string;
        }>();

        // Collect actual consumption data for stock_movements (will be processed after items are saved)
        const actualConsumptionData: Array<{ code: string; date: string; quantity: number }> = [];

        // Collect all planned and actual consumption data
        const allPlannedConsumption: Array<{ code: string; date: string; quantity: number }> = [];
        for (const item of items) {
            const code = item.code?.trim();
            if (!code) continue;

            if (item.plannedConsumption && item.plannedConsumption.length > 0) {
                item.plannedConsumption.forEach((pc: { date: string; quantity: number; isActual?: boolean }) => {
                    if (pc.quantity <= 0) return;

                    // Фактический расход (isActual === true) - сохраним в stock_movements после сохранения items
                    if (pc.isActual === true) {
                        actualConsumptionData.push({ code, date: pc.date, quantity: pc.quantity });
                        return;
                    }

                    // Плановый расход (isActual === false или undefined) - сохраняем в planned_consumption
                    allPlannedConsumption.push({ code, date: pc.date, quantity: pc.quantity });
                });
            }
        }

        // Now process planned consumption using refreshed skuToIdMap (after items are saved)
        for (const pcData of allPlannedConsumption) {
            const code = pcData.code;
            const itemId = skuToIdMap.get(code);

            if (!itemId) {
                console.warn(`[Import] Skipping planned consumption for code ${code}: item not found in database after save`);
                continue;
            }

            // Use composite key to prevent duplicates: item_id + planned_date
            const key = `${itemId}_${pcData.date}`;

            // Ensure date is in YYYY-MM-01 format (first day of month)
            let normalizedDate = pcData.date;
            if (normalizedDate && !normalizedDate.endsWith('-01')) {
                // If date is not in YYYY-MM-01 format, normalize it
                try {
                    const date = new Date(normalizedDate);
                    if (!isNaN(date.getTime())) {
                        normalizedDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
                    }
                } catch (e) {
                    console.warn(`[Import] Invalid date format: ${normalizedDate}, using as-is`);
                }
            }

            // If duplicate exists, use the last (most recent) value
            plannedConsumptionMap.set(key, {
                item_id: itemId, // Always use UUID
                planned_date: normalizedDate,
                quantity: pcData.quantity,
                notes: `Импортировано из Excel`
            });
            console.log(`[Import] Saving planned consumption: itemId=${itemId} (UUID, code=${code}), date=${normalizedDate}, quantity=${pcData.quantity}`);
        }

        const plannedConsumptionInserts = Array.from(plannedConsumptionMap.values());

        if (plannedConsumptionInserts.length > 0) {
            console.log(`Импортируем плановые расходы для ${plannedConsumptionInserts.length} записей (после удаления дубликатов)...`);
            console.log('[Import] Sample planned consumption to insert:', plannedConsumptionInserts.slice(0, 5));

            const { error: plannedError, data: insertedData } = await supabase
                .from('planned_consumption')
                .upsert(plannedConsumptionInserts, {
                    onConflict: 'item_id,planned_date',
                    ignoreDuplicates: false
                })
                .select();

            if (plannedError) {
                console.error('Error upserting planned consumption:', plannedError);
                // Don't throw - planned consumption is optional
                console.warn('Плановые расходы не были импортированы, но материалы и остатки сохранены');
            } else {
                console.log(`Плановые расходы успешно импортированы (${plannedConsumptionInserts.length} записей)`);
                if (insertedData && insertedData.length > 0) {
                    console.log('[Import] Sample inserted planned consumption:', insertedData.slice(0, 3));
                }

                // Уведомляем о обновлении planned consumption через localStorage
                if (typeof window !== 'undefined') {
                    localStorage.setItem('planned_consumption_updated', Date.now().toString());
                    // Также отправляем событие для обновления в текущей вкладке
                    window.dispatchEvent(new Event('storage'));
                }
            }
        } else {
            console.log('[Import] Нет плановых расходов для импорта (все записи были фактическими или пустыми)');
        }

        // 7. Import actual consumption as stock_movements (type='out')
        // Process actual consumption AFTER items are saved (so we have correct item IDs)
        if (actualConsumptionData.length > 0) {
            console.log(`Импортируем фактический расход для ${actualConsumptionData.length} записей...`);

            const actualConsumptionMovements: Array<{
                item_id: string;
                quantity: number;
                date: string;
                type: 'out';
                comment?: string;
            }> = [];

            // Process actual consumption data using refreshed skuToIdMap
            for (const acData of actualConsumptionData) {
                const code = acData.code;
                const itemId = skuToIdMap.get(code);

                if (!itemId) {
                    console.warn(`[Import] Skipping actual consumption for code ${code}: item not found in database after save`);
                    continue;
                }

                // Normalize date to first day of month
                let normalizedDate = acData.date;
                if (normalizedDate && !normalizedDate.endsWith('-01')) {
                    try {
                        const date = new Date(normalizedDate);
                        if (!isNaN(date.getTime())) {
                            normalizedDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
                        }
                    } catch (e) {
                        console.warn(`[Import] Invalid date format for actual consumption: ${normalizedDate}`);
                        continue;
                    }
                }

                // Use 15th day of the month for the movement date
                const dateObj = new Date(normalizedDate);
                const movementDate = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-15`;

                actualConsumptionMovements.push({
                    item_id: itemId,
                    quantity: acData.quantity,
                    date: movementDate,
                    type: 'out',
                    comment: `Импортировано из Excel (фактический расход за ${normalizedDate.substring(0, 7)})`
                });
                console.log(`[Import] Saving actual consumption: itemId=${itemId} (code=${code}), date=${movementDate}, quantity=${acData.quantity}`);
            }

            // Group by item_id and date to avoid duplicates (sum quantities if same item+date)
            const movementsMap = new Map<string, {
                item_id: string;
                quantity: number;
                date: string;
                type: 'out';
                comment?: string;
            }>();

            actualConsumptionMovements.forEach(movement => {
                const key = `${movement.item_id}_${movement.date}`;
                const existing = movementsMap.get(key);
                if (existing) {
                    existing.quantity += movement.quantity;
                } else {
                    movementsMap.set(key, { ...movement });
                }
            });

            const uniqueMovements = Array.from(movementsMap.values());
            console.log(`[Import] Unique actual consumption movements: ${uniqueMovements.length} (from ${actualConsumptionMovements.length} total)`);

            // Insert stock movements
            // Use date field if available, otherwise use created_at (which will be set automatically)
            const { error: movementsError } = await supabase
                .from('stock_movements')
                .insert(uniqueMovements.map(m => {
                    const movementData: any = {
                        item_id: m.item_id,
                        quantity: m.quantity,
                        type: m.type,
                        comment: m.comment,
                        source_warehouse_id: 'wh-kotsyubinske' // Default warehouse for imported consumption
                    };

                    // Try to set date field if it exists in the table
                    // If date field doesn't exist, Supabase will ignore it
                    // The created_at will be set automatically
                    try {
                        movementData.date = m.date;
                    } catch (e) {
                        // Ignore if date field doesn't exist
                    }

                    return movementData;
                }));

            if (movementsError) {
                console.error('Error inserting actual consumption movements:', movementsError);
                // Don't throw - actual consumption is optional
                console.warn('Фактический расход не был импортирован, но материалы и плановый расход сохранены');
            } else {
                console.log(`Фактический расход успешно импортирован (${uniqueMovements.length} записей)`);
            }
        } else {
            console.log('[Import] Нет фактического расхода для импорта');
        }

        console.log('Импорт завершен успешно!');
    },

    async importSuppliers(suppliers: Array<{ name: string }>) {
        if (!supabase) {
            console.error('Supabase not connected');
            throw new Error('База данных не подключена');
        }

        if (!suppliers || suppliers.length === 0) {
            console.log('Нет поставщиков для импорта');
            return;
        }

        console.log(`Начинаем импорт ${suppliers.length} поставщиков...`);

        // Get unique supplier names (remove duplicates)
        const uniqueSuppliers = Array.from(
            new Map(suppliers.map(s => [s.name?.trim().toLowerCase(), s])).values()
        ).filter(s => s.name && s.name.trim() !== '');

        console.log(`Найдено ${uniqueSuppliers.length} уникальных поставщиков (из ${suppliers.length})`);

        // Prepare suppliers for upsert
        // Use Maps to ensure uniqueness of IDs and codes within the batch
        const usedIds = new Map<string, number>();
        const usedCodes = new Map<string, number>();

        const dbSuppliers = uniqueSuppliers.map((supplier) => {
            const name = supplier.name.trim();
            const nameLower = name.toLowerCase();

            // Generate base ID from name
            let baseId = `supplier-${nameLower.replace(/[^a-z0-9]/g, '-').substring(0, 30)}`;
            let id = baseId;

            // Ensure ID uniqueness within the batch
            if (usedIds.has(id)) {
                const count = usedIds.get(id)! + 1;
                usedIds.set(id, count);
                id = `${baseId}-${count}`;
            } else {
                usedIds.set(id, 1);
            }

            // Generate code from name
            let baseCode = name
                .substring(0, 20)
                .toUpperCase()
                .replace(/\s+/g, '_')
                .replace(/[^A-Z0-9_А-ЯЁ]/g, '')
                .replace(/[А-ЯЁ]/g, (char) => {
                    const map: Record<string, string> = {
                        'А': 'A', 'Б': 'B', 'В': 'V', 'Г': 'G', 'Д': 'D', 'Е': 'E', 'Ё': 'E',
                        'Ж': 'ZH', 'З': 'Z', 'И': 'I', 'Й': 'Y', 'К': 'K', 'Л': 'L', 'М': 'M',
                        'Н': 'N', 'О': 'O', 'П': 'P', 'Р': 'R', 'С': 'S', 'Т': 'T', 'У': 'U',
                        'Ф': 'F', 'Х': 'H', 'Ц': 'TS', 'Ч': 'CH', 'Ш': 'SH', 'Щ': 'SCH',
                        'Ъ': '', 'Ы': 'Y', 'Ь': '', 'Э': 'E', 'Ю': 'YU', 'Я': 'YA'
                    };
                    return map[char] || '';
                });

            if (!baseCode || baseCode.length < 3) {
                baseCode = `SUP_${id.slice(-8)}`;
            }

            let code = baseCode;

            // Ensure code uniqueness within the batch
            if (usedCodes.has(code)) {
                const count = usedCodes.get(code)! + 1;
                usedCodes.set(code, count);
                code = `${baseCode}_${count}`;
            } else {
                usedCodes.set(code, 1);
            }

            return {
                id,
                name,
                code,
                contact_person: null,
                phone: null,
                email: null,
            };
        });

        // Remove duplicates by ID (final safety check)
        const finalSuppliersMap = new Map<string, typeof dbSuppliers[0]>();
        dbSuppliers.forEach(supplier => {
            if (!finalSuppliersMap.has(supplier.id)) {
                finalSuppliersMap.set(supplier.id, supplier);
            } else {
                console.warn(`Duplicate ID detected and removed: ${supplier.id} (${supplier.name})`);
            }
        });

        const finalSuppliers = Array.from(finalSuppliersMap.values());

        console.log(`Подготовлено ${finalSuppliers.length} уникальных поставщиков для импорта (из ${dbSuppliers.length} после обработки)`);

        // Upsert suppliers
        // IMPORTANT: Do not use .select() after upsert to avoid updated_at field errors
        // The database trigger will handle updated_at automatically
        const { error: suppliersError } = await supabase
            .from('contractors')
            .upsert(finalSuppliers, {
                onConflict: 'id',
                ignoreDuplicates: false
            });

        if (suppliersError) {
            console.error('Error upserting suppliers:', suppliersError);
            throw new Error(`Ошибка при сохранении поставщиков: ${suppliersError.message}`);
        }

        console.log(`Успешно сохранено/обновлено ${finalSuppliers.length} поставщиков`);
    },

    async deleteItem(itemId: string): Promise<void> {
        if (!supabase) {
            return;
        }

        // Delete stock levels first (foreign key constraint)
        const { error: stockError } = await supabase
            .from('stock_levels')
            .delete()
            .eq('item_id', itemId);

        if (stockError) {
            console.error('Error deleting stock levels:', stockError);
            throw stockError;
        }

        // Delete the item
        const { error: itemError } = await supabase
            .from('items')
            .delete()
            .eq('id', itemId);

        if (itemError) {
            console.error('Error deleting item:', itemError);
            throw itemError;
        }
    },

    async getPlannedConsumption(itemId: string, startDate?: string, endDate?: string): Promise<PlannedConsumption[]> {
        if (!supabase) return [];

        let query = supabase
            .from('planned_consumption')
            .select('*')
            .eq('item_id', itemId)
            .order('planned_date', { ascending: true });

        if (startDate) {
            query = query.gte('planned_date', startDate);
        }
        if (endDate) {
            query = query.lte('planned_date', endDate);
        }

        const { data, error } = await query;
        if (error) {
            console.error('Error fetching planned consumption:', error);
            return [];
        }

        return (data || []).map((pc: any) => ({
            id: pc.id,
            itemId: pc.item_id,
            plannedDate: pc.planned_date,
            quantity: Number(pc.quantity),
            notes: pc.notes || undefined,
            createdAt: pc.created_at,
            updatedAt: pc.updated_at,
            createdBy: pc.created_by || undefined,
        }));
    },

    async savePlannedConsumption(itemId: string, plannedDate: string, quantity: number, notes?: string): Promise<PlannedConsumption> {
        if (!supabase) {
            throw new Error('База данных не подключена');
        }

        const { data, error } = await supabase
            .from('planned_consumption')
            .upsert({
                item_id: itemId,
                planned_date: plannedDate,
                quantity,
                notes: notes || null,
            }, { onConflict: 'item_id,planned_date' })
            .select()
            .single();

        if (error) {
            console.error('Error saving planned consumption:', error);
            throw new Error(`Ошибка при сохранении планового расхода: ${error.message}`);
        }

        return {
            id: data.id,
            itemId: data.item_id,
            plannedDate: data.planned_date,
            quantity: Number(data.quantity),
            notes: data.notes || undefined,
            createdAt: data.created_at,
            updatedAt: data.updated_at,
            createdBy: data.created_by || undefined,
        };
    },

    async deletePlannedConsumption(id: string): Promise<void> {
        if (!supabase) {
            throw new Error('База данных не подключена');
        }

        const { error } = await supabase
            .from('planned_consumption')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting planned consumption:', error);
            throw new Error(`Ошибка при удалении планового расхода: ${error.message}`);
        }
    }
};
