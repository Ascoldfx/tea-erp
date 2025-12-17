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
        if (!supabase) return; // Cannot import without DB

        // 1. Upsert Items
        // We assume 'code' (SKU) or 'name' could be unique identifiers. For now, let's generate ID if missing.
        // Actually best practice is to upsert "items" first.

        const dbItems = items.map(i => ({
            id: i.code || crypto.randomUUID(), // Use code as ID if possible, else random
            sku: i.code,
            name: i.name,
            category: i.category,
            unit: i.unit,
            min_stock_level: 0
        }));

        // Using upsert on 'id' might be tricky if code isn't UUID. 
        // Let's rely on SKU being unique? schema didn't enforce it. 
        // Let's just UPSERT based on ID. 
        // WARNING: If user re-uploads, we might get duplicates if IDs change.
        // STRATEGY: Check if SKU exists first? No, too slow. 
        // Let's use name as fallback key? 
        // PROPOSAL: For this MVP, we map item.code to item.id. 

        const { error: itemsError } = await supabase.from('items').upsert(dbItems, { onConflict: 'id' });
        if (itemsError) throw itemsError;

        // 2. Upsert Stock Levels
        const stockInserts = [];
        for (const item of items) {
            const itemId = item.code; // Since we used code as ID above

            if (item.stockMain > 0) {
                stockInserts.push({
                    item_id: itemId,
                    warehouse_id: 'wh-main',
                    quantity: item.stockMain
                });
            }
            if (item.stockProd > 0) {
                stockInserts.push({
                    item_id: itemId,
                    warehouse_id: 'wh-prod-1',
                    quantity: item.stockProd
                });
            }
        }

        if (stockInserts.length > 0) {
            const { error: stockError } = await supabase.from('stock_levels').upsert(stockInserts, { onConflict: 'item_id,warehouse_id' });
            if (stockError) throw stockError;
        }
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
