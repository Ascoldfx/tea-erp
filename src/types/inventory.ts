export type Unit = 'kg' | 'g' | 'l' | 'ml' | 'pcs';

export interface Warehouse {
    id: string;
    name: string;
    location: string;
    description?: string;
}

export type InventoryCategory = 'tea_bulk' | 'flavor' | 'packaging_consumable' | 'packaging_box' | 'packaging_crate' | 'label' | 'other';

export interface InventoryItem {
    id: string;
    name: string;
    sku: string;
    category: InventoryCategory;
    unit: Unit;
    minStockLevel: number;
    description?: string;
}

export interface StockLevel {
    id: string;
    warehouseId: string;
    itemId: string;
    quantity: number;
    lastUpdated: string;
}

export interface StockTransfer {
    id: string;
    sourceWarehouseId: string;
    targetWarehouseId: string;
    itemId: string;
    quantity: number;
    date: string;
    status: 'pending' | 'completed' | 'cancelled';
    performedBy: string;
}

export interface MaterialOrder {
    id: string;
    itemId: string;
    quantity: number;
    estimatedArrival: string; // ISO date
    status: 'ordered' | 'shipped' | 'delivered' | 'cancelled';
    supplierName?: string;
    contractorId?: string;
    totalCost?: number;
    paidAmount?: number;
    deliveryMethod?: 'pickup' | 'nova_poshta';
    specificationNumber?: string;
}

export interface StockMovementLog {
    id: string;
    itemId: string;
    quantity: number;
    type: 'in' | 'out' | 'transfer' | 'adjustment';
    date: string; // ISO date
    source?: string; // e.g., "Supplier" or Warehouse Name
    target?: string; // e.g., Warehouse Name
}
