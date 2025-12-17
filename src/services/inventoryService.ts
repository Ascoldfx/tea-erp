import { supabase } from '../lib/supabase';
import { MOCK_ITEMS, MOCK_STOCK, MOCK_WAREHOUSES } from '../data/mockInventory';
import type { InventoryItem, StockLevel, Warehouse } from '../types/inventory';

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
        const dbItems = items.map(i => {
            const code = i.code?.trim();
            if (!code) {
                throw new Error(`Найден материал без кода: ${i.name || 'Неизвестный'}`);
            }

            // Check if we have existing item with this SKU
            let itemId = skuToIdMap.get(code);
            
            // If not found, use code as ID (assuming code is valid text identifier)
            // If code looks like UUID, use it directly, otherwise use code as-is
            if (!itemId) {
                itemId = code; // Use code as ID (items.id is TEXT, so this should work)
            }

            return {
                id: itemId,
                sku: code,
                name: i.name?.trim() || 'Без названия',
                category: i.category || 'other',
                unit: i.unit || 'pcs',
                min_stock_level: 0
            };
        });

        console.log(`Подготовлено ${dbItems.length} материалов для импорта`);

        // 3. Upsert items (onConflict: 'id' means update if exists, insert if not)
        const { error: itemsError, data: insertedItems } = await supabase
            .from('items')
            .upsert(dbItems, { onConflict: 'id' })
            .select();

        if (itemsError) {
            console.error('Error upserting items:', itemsError);
            throw new Error(`Ошибка при сохранении материалов: ${itemsError.message}`);
        }

        console.log(`Успешно сохранено/обновлено ${insertedItems?.length || dbItems.length} материалов`);

        // 4. Prepare stock levels
        const stockInserts = [];
        for (const item of items) {
            const code = item.code?.trim();
            if (!code) continue;

            // Get the item ID (either from map or use code)
            const itemId = skuToIdMap.get(code) || code;

            // Main warehouse stock
            if (item.stockMain > 0 || item.stockMain === 0) {
                stockInserts.push({
                    item_id: itemId,
                    warehouse_id: 'wh-main',
                    quantity: Number(item.stockMain) || 0
                });
            }

            // Production warehouse stock
            if (item.stockProd > 0 || item.stockProd === 0) {
                stockInserts.push({
                    item_id: itemId,
                    warehouse_id: 'wh-prod-1',
                    quantity: Number(item.stockProd) || 0
                });
            }
        }

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

        console.log('Импорт завершен успешно!');
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
    }
};
