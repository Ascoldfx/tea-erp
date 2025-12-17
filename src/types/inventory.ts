export type Unit = 'kg' | 'g' | 'l' | 'ml' | 'pcs';

export type WarehouseType = 'internal' | 'supplier' | 'contractor';

export interface Warehouse {
    id: string;
    name: string;
    location: string;
    description?: string;
    type?: WarehouseType;
    contractor_id?: string;
}

// Base categories - can be extended with dynamic categories from database
export type BaseInventoryCategory = 'tea_bulk' | 'flavor' | 'packaging_consumable' | 'packaging_box' | 'packaging_crate' | 'label' | 'sticker' | 'soft_packaging' | 'envelope' | 'packaging_cardboard' | 'other';
// Allow string for dynamic categories from Excel imports
export type InventoryCategory = BaseInventoryCategory | string;

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

export interface PlannedConsumption {
    id: string;
    itemId: string;
    plannedDate: string; // ISO date (YYYY-MM-DD)
    quantity: number;
    notes?: string;
    createdAt: string;
    updatedAt: string;
    createdBy?: string;
}
