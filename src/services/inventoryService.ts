import { supabase } from '../lib/supabase';
import { MOCK_ITEMS, MOCK_STOCK, MOCK_WAREHOUSES } from '../data/mockInventory';
import type { InventoryItem, StockLevel, Warehouse, PlannedConsumption } from '../types/inventory';

export const inventoryService = {
    async getItems(): Promise<InventoryItem[]> {
        if (!supabase) return MOCK_ITEMS;

        const { data, error } = await supabase.from('items').select('*');
        if (error) {
            console.error('Error fetching items:', error);
            return MOCK_ITEMS;
        }
        return data as InventoryItem[];
    },

    async getWarehouses(): Promise<Warehouse[]> {
        if (!supabase) return MOCK_WAREHOUSES;

        const { data, error } = await supabase.from('warehouses').select('*');
        if (error) return MOCK_WAREHOUSES;
        return data as Warehouse[];
    },

    async getStockLevels(): Promise<StockLevel[]> {
        if (!supabase) return MOCK_STOCK;

        const { data, error } = await supabase.from('stock_levels').select('*');
        if (error) return MOCK_STOCK;

        // Map snake_case DB columns to camelCase TS interface
        return data.map((s: any) => ({
            id: s.id,
            warehouseId: s.warehouse_id,
            itemId: s.item_id,
            quantity: s.quantity,
            lastUpdated: s.updated_at
        })) as StockLevel[];
    },

    // Example of a mutation
    async transferStock(sourceId: string, targetId: string, itemId: string, qty: number) {
        if (!supabase) {
            console.log('Mock Transfer:', { sourceId, targetId, itemId, qty });
            return true;
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

        // 1. Get all existing items by SKU to map codes to IDs
        const skus = items.map(i => i.code).filter(Boolean);
        const { data: existingItems, error: fetchError } = await supabase
            .from('items')
            .select('id, sku')
            .in('sku', skus);

        if (fetchError) {
            console.error('Error fetching existing items:', fetchError);
            throw new Error(`Ошибка при проверке существующих материалов: ${fetchError.message}`);
        }

        // Create a map: SKU -> ID
        const skuToIdMap = new Map<string, string>();
        if (existingItems) {
            existingItems.forEach(item => {
                if (item.sku) {
                    skuToIdMap.set(item.sku, item.id);
                }
            });
        }

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
            const category = i.category || 'other';
            if (category === 'flavor') {
                console.log(`[Category Debug] Material "${i.name}" assigned to flavor category`);
            }
            // Normalize unit: convert pcs to шт
            let normalizedUnit = i.unit || 'шт';
            if (normalizedUnit.toLowerCase() === 'pcs') {
                normalizedUnit = 'шт';
            }
            
            itemsMap.set(itemId, {
                id: itemId,
                sku: code,
                name: i.name?.trim() || 'Без названия',
                category: category, // Always use the category from import
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
        
        for (const item of items) {
            const code = item.code?.trim();
            if (!code) continue;

            // Get the item ID (either from map or use code)
            const itemId = skuToIdMap.get(code) || code;

            // Main warehouse stock (Коцюбинське / 1С) - sum if multiple rows have same code
            const mainKey = `${itemId}_wh-kotsyubinske`;
            const currentMain = stockMap.get(mainKey);
            const mainQty = Number(item.stockMain) || 0;
            if (currentMain) {
                currentMain.quantity += mainQty; // Sum quantities for duplicates
            } else if (mainQty > 0) {
                stockMap.set(mainKey, {
                    item_id: itemId,
                    warehouse_id: 'wh-kotsyubinske',
                    quantity: mainQty
                });
            }

            // Май warehouse stock (ТС) - sum if multiple rows have same code
            const maiKey = `${itemId}_wh-ts`;
            const currentMai = stockMap.get(maiKey);
            const maiQty = Number(item.stockMai) || 0;
            if (currentMai) {
                currentMai.quantity += maiQty; // Sum quantities for duplicates
            } else if (maiQty > 0) {
                stockMap.set(maiKey, {
                    item_id: itemId,
                    warehouse_id: 'wh-ts',
                    quantity: maiQty
                });
            }

            // Фито warehouse stock - sum if multiple rows have same code
            const fitoKey = `${itemId}_wh-fito`;
            const currentFito = stockMap.get(fitoKey);
            const fitoQty = Number(item.stockFito) || 0;
            if (currentFito) {
                currentFito.quantity += fitoQty; // Sum quantities for duplicates
            } else if (fitoQty > 0) {
                stockMap.set(fitoKey, {
                    item_id: itemId,
                    warehouse_id: 'wh-fito',
                    quantity: fitoQty
                });
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
        const plannedConsumptionInserts: Array<{
            item_id: string;
            planned_date: string;
            quantity: number;
            notes?: string;
        }> = [];

        for (const item of items) {
            const code = item.code?.trim();
            if (!code) continue;

            const itemId = skuToIdMap.get(code) || code;
            
            if (item.plannedConsumption && item.plannedConsumption.length > 0) {
                item.plannedConsumption.forEach((pc: { date: string; quantity: number }) => {
                    plannedConsumptionInserts.push({
                        item_id: itemId,
                        planned_date: pc.date,
                        quantity: pc.quantity,
                        notes: `Импортировано из Excel`
                    });
                });
            }
        }

        if (plannedConsumptionInserts.length > 0) {
            console.log(`Импортируем плановые расходы для ${plannedConsumptionInserts.length} записей...`);
            const { error: plannedError } = await supabase
                .from('planned_consumption')
                .upsert(plannedConsumptionInserts, { 
                    onConflict: 'item_id,planned_date',
                    ignoreDuplicates: false
                });

            if (plannedError) {
                console.error('Error upserting planned consumption:', plannedError);
                // Don't throw - planned consumption is optional
                console.warn('Плановые расходы не были импортированы, но материалы и остатки сохранены');
            } else {
                console.log(`Плановые расходы успешно импортированы (${plannedConsumptionInserts.length} записей)`);
            }
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
            console.log('Mock Delete:', itemId);
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
