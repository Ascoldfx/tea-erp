import { useState, useEffect } from 'react';
import type { InventoryItem, StockLevel, Warehouse } from '../types/inventory';
import { inventoryService } from '../services/inventoryService';

export function useInventory() {
    const [items, setItems] = useState<InventoryItem[]>([]);
    const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
    const [stock, setStock] = useState<StockLevel[]>([]);
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
        } catch (error) {
            console.error("Failed to load inventory:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        refresh();
    }, []);

    return { items, warehouses, stock, loading, refresh };
}
