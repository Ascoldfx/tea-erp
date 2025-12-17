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
                    const { data } = await supabase
                        .from('planned_consumption')
                        .select('*');
                    setPlannedConsumption(data || []);
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
