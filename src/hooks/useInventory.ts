import { useState, useEffect } from 'react';
import type { InventoryItem, StockLevel, Warehouse, PlannedConsumption } from '../types/inventory';
import { inventoryService } from '../services/inventoryService';

export function useInventory() {
    const [items, setItems] = useState<InventoryItem[]>([]);
    const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
    const [stock, setStock] = useState<StockLevel[]>([]);
    const [plannedConsumption, setPlannedConsumption] = useState<PlannedConsumption[]>([]);
    const [loading, setLoading] = useState(true);

    const refresh = async () => {
        setLoading(true);
        try {
            const [fetchedItems, fetchedWarehouses, fetchedStock] = await Promise.all([
                inventoryService.getItems(),
                inventoryService.getWarehouses(),
                inventoryService.getStockLevels()
            ]);
            setItems(fetchedItems);
            setWarehouses(fetchedWarehouses);
            setStock(fetchedStock);

            // Fetch all planned consumption for filtering
            if (fetchedItems.length > 0) {
                const { supabase } = await import('../lib/supabase');
                if (supabase) {
                    let allPlannedConsumption: any[] = [];
                    let from = 0;
                    let hasMore = true;
                    const BATCH_SIZE = 1000;

                    while (hasMore) {
                        const { data, error } = await supabase
                            .from('planned_consumption')
                            .select('*')
                            .range(from, from + BATCH_SIZE - 1);

                        if (error) {
                            console.error('Error fetching planned consumption batch:', error);
                            break;
                        }

                        if (data && data.length > 0) {
                            allPlannedConsumption = [...allPlannedConsumption, ...data];
                            from += BATCH_SIZE;
                            if (data.length < BATCH_SIZE) hasMore = false;
                        } else {
                            hasMore = false;
                        }
                    }

                    const data = allPlannedConsumption;
                    console.log(`[useInventory] Loaded ${data.length} planned consumption entries`);

                    if (data.length > 0) {
                        // Transform snake_case DB columns to camelCase TS interface
                        const transformed = data.map((pc: any) => ({
                            id: pc.id,
                            itemId: pc.item_id,
                            plannedDate: pc.planned_date,
                            quantity: pc.quantity || 0,
                            notes: pc.notes || null,
                            createdAt: pc.created_at,
                            updatedAt: pc.updated_at
                        }));
                        setPlannedConsumption(transformed);
                    } else {
                        setPlannedConsumption([]);
                    }
                }
            }
        } catch (error) {
            console.error("Failed to load inventory:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        refresh();
    }, []);

    return { items, warehouses, stock, plannedConsumption, loading, refresh };
}
