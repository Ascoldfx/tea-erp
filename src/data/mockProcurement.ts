import type { MaterialOrder, StockMovementLog } from '../types/inventory';

export const MOCK_ORDERS: MaterialOrder[] = [
    { id: 'ord-001', itemId: 'tea-001', quantity: 500, estimatedArrival: '2023-11-20', status: 'shipped', supplierName: 'Ceylon Tea Co.' },
    { id: 'ord-002', itemId: 'flv-001', quantity: 50, estimatedArrival: '2023-11-25', status: 'ordered', supplierName: 'FlavorMaster' },
    { id: 'ord-003', itemId: 'pak-box-25-std', quantity: 10000, estimatedArrival: '2023-11-18', status: 'shipped', supplierName: 'PrintPack Ltd.' },
    { id: 'ord-004', itemId: 'mat-filter', quantity: 200, estimatedArrival: '2023-12-01', status: 'ordered', supplierName: 'PaperMills Inc.' }
];

export const MOCK_MOVEMENT_LOGS: StockMovementLog[] = [
    { id: 'mov-101', itemId: 'tea-001', quantity: 200, type: 'in', date: '2023-10-15T10:00:00', source: 'Supplier', target: 'Главный склад' },
    { id: 'mov-102', itemId: 'tea-001', quantity: 50, type: 'transfer', date: '2023-10-16T14:30:00', source: 'Главный склад', target: 'Цех (IMA C23 #1)' },
    { id: 'mov-103', itemId: 'flv-001', quantity: 10, type: 'in', date: '2023-10-20T09:15:00', source: 'Supplier', target: 'Главный склад' },
    { id: 'mov-104', itemId: 'pak-box-25-std', quantity: 5000, type: 'in', date: '2023-10-22T11:00:00', source: 'Supplier', target: 'Главный склад' },
    { id: 'mov-105', itemId: 'mat-thread', quantity: 20, type: 'adjustment', date: '2023-10-25T16:00:00', source: 'Inventory Check', target: 'Главный склад' }
];
