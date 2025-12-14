import type { Warehouse, InventoryItem, StockLevel } from '../types/inventory';

export const MOCK_WAREHOUSES: Warehouse[] = [
    { id: 'wh-main', name: 'Главный склад', location: 'Москва, Основной терминал', description: 'Сырье и материалы' },
    { id: 'wh-prod-1', name: 'Цех (IMA C23 #1)', location: 'Производство, Линия 1', description: 'Оперативный запас на линии' },
    { id: 'wh-prod-2', name: 'Цех (IMA C23 #2)', location: 'Производство, Линия 2', description: 'Оперативный запас на линии' },
    { id: 'wh-contractor', name: 'Склад Подрядчика', location: 'Внешний', description: 'Материалы у фасовщика' },
];

export const MOCK_ITEMS: InventoryItem[] = [
    // --- TEA (5 types) ---
    { id: 'tea-001', name: 'Чай Черный Цейлонский (Крупный)', sku: 'TEA-BLK-CEY', category: 'tea_bulk', unit: 'kg', minStockLevel: 500 },
    { id: 'tea-002', name: 'Чай Зеленый Сенча', sku: 'TEA-GRN-SEN', category: 'tea_bulk', unit: 'kg', minStockLevel: 300 },
    { id: 'tea-003', name: 'Эрл Грей Основа', sku: 'TEA-BLK-EARL', category: 'tea_bulk', unit: 'kg', minStockLevel: 400 },
    { id: 'tea-004', name: 'Травяной Сбор "Альпийский"', sku: 'TEA-HRB-ALP', category: 'tea_bulk', unit: 'kg', minStockLevel: 200 },
    { id: 'tea-005', name: 'Чай Фруктовый "Лесные Ягоды"', sku: 'TEA-FRT-BER', category: 'tea_bulk', unit: 'kg', minStockLevel: 250 },

    // --- FLAVORS (20 types) - NOW IN KG ---
    { id: 'flv-001', name: 'Ароматизатор "Бергамот"', sku: 'FLV-BERG', category: 'flavor', unit: 'kg', minStockLevel: 20 },
    { id: 'flv-002', name: 'Ароматизатор "Лимон"', sku: 'FLV-LEM', category: 'flavor', unit: 'kg', minStockLevel: 15 },
    { id: 'flv-003', name: 'Ароматизатор "Мята"', sku: 'FLV-MNT', category: 'flavor', unit: 'kg', minStockLevel: 10 },
    { id: 'flv-004', name: 'Ароматизатор "Жасмин"', sku: 'FLV-JAS', category: 'flavor', unit: 'kg', minStockLevel: 10 },
    { id: 'flv-005', name: 'Ароматизатор "Ваниль"', sku: 'FLV-VAN', category: 'flavor', unit: 'kg', minStockLevel: 10 },
    { id: 'flv-006', name: 'Ароматизатор "Клубника"', sku: 'FLV-STR', category: 'flavor', unit: 'kg', minStockLevel: 15 },
    { id: 'flv-007', name: 'Ароматизатор "Малина"', sku: 'FLV-RAS', category: 'flavor', unit: 'kg', minStockLevel: 15 },
    { id: 'flv-008', name: 'Ароматизатор "Персик"', sku: 'FLV-PCH', category: 'flavor', unit: 'kg', minStockLevel: 10 },
    { id: 'flv-009', name: 'Ароматизатор "Манго"', sku: 'FLV-MNG', category: 'flavor', unit: 'kg', minStockLevel: 10 },
    { id: 'flv-010', name: 'Ароматизатор "Корица"', sku: 'FLV-CIN', category: 'flavor', unit: 'kg', minStockLevel: 5 },
    { id: 'flv-011', name: 'Ароматизатор "Имбирь"', sku: 'FLV-GNG', category: 'flavor', unit: 'kg', minStockLevel: 5 },
    { id: 'flv-012', name: 'Ароматизатор "Мед"', sku: 'FLV-HNY', category: 'flavor', unit: 'kg', minStockLevel: 10 },
    { id: 'flv-013', name: 'Ароматизатор "Шоколад"', sku: 'FLV-CHC', category: 'flavor', unit: 'kg', minStockLevel: 5 },
    { id: 'flv-014', name: 'Ароматизатор "Карамель"', sku: 'FLV-CRL', category: 'flavor', unit: 'kg', minStockLevel: 10 },
    { id: 'flv-015', name: 'Ароматизатор "Черная Смородина"', sku: 'FLV-CUR', category: 'flavor', unit: 'kg', minStockLevel: 15 },
    { id: 'flv-016', name: 'Ароматизатор "Апельсин"', sku: 'FLV-ORG', category: 'flavor', unit: 'kg', minStockLevel: 15 },
    { id: 'flv-017', name: 'Ароматизатор "Грейпфрут"', sku: 'FLV-GRP', category: 'flavor', unit: 'kg', minStockLevel: 10 },
    { id: 'flv-018', name: 'Ароматизатор "Липа"', sku: 'FLV-LIN', category: 'flavor', unit: 'kg', minStockLevel: 5 },
    { id: 'flv-019', name: 'Ароматизатор "Чабрец"', sku: 'FLV-THY', category: 'flavor', unit: 'kg', minStockLevel: 5 },
    { id: 'flv-020', name: 'Ароматизатор "Ромашка"', sku: 'FLV-CHM', category: 'flavor', unit: 'kg', minStockLevel: 5 },

    // --- PACKAGING CONSUMABLES ---
    { id: 'mat-thread', name: 'Нитка для чайных пакетиков (Бобина)', sku: 'MAT-THR', category: 'packaging_consumable', unit: 'kg', minStockLevel: 100 }, // Requested kg (often wire/thread treated same)
    { id: 'mat-tag', name: 'Ярлык чайный (Рулон)', sku: 'MAT-TAG', category: 'packaging_consumable', unit: 'pcs', minStockLevel: 200 }, // Kept pcs (labels usually counted or rolls)
    { id: 'mat-filter', name: 'Фильтр-бумага (Рулон)', sku: 'MAT-FLT', category: 'packaging_consumable', unit: 'kg', minStockLevel: 500 },
    { id: 'mat-wire', name: 'Проволока (Скоба)', sku: 'MAT-WIR', category: 'packaging_consumable', unit: 'kg', minStockLevel: 50 },
    { id: 'mat-envelope', name: 'Индивидуальный конверт (Фольга)', sku: 'MAT-ENV', category: 'packaging_consumable', unit: 'kg', minStockLevel: 200 },

    // --- PACKAGING: SOFT PACKS (4-6 types) ---
    { id: 'pak-soft-100g', name: 'Дой-пак 100г (Крафт)', sku: 'PAK-SFT-100K', category: 'packaging_consumable', unit: 'kg', minStockLevel: 100 },
    { id: 'pak-soft-200g', name: 'Дой-пак 200г (Крафт)', sku: 'PAK-SFT-200K', category: 'packaging_consumable', unit: 'kg', minStockLevel: 100 },
    { id: 'pak-soft-100g-w', name: 'Дой-пак 100г (Белый)', sku: 'PAK-SFT-100W', category: 'packaging_consumable', unit: 'kg', minStockLevel: 100 },
    { id: 'pak-soft-200g-w', name: 'Дой-пак 200г (Белый)', sku: 'PAK-SFT-200W', category: 'packaging_consumable', unit: 'kg', minStockLevel: 100 },
    { id: 'pak-soft-premium', name: 'Дой-пак (Премиум Черный)', sku: 'PAK-SFT-PREM', category: 'packaging_consumable', unit: 'kg', minStockLevel: 50 },

    // --- PACKAGING: CELLOPHANE ---
    { id: 'pak-cello', name: 'Целлофан (Рулон)', sku: 'PAK-CEL', category: 'packaging_consumable', unit: 'kg', minStockLevel: 100 },

    // --- PACKAGING: CARDBOARD BOXES (4-6 types) ---
    { id: 'pak-box-25-std', name: 'Пачка 25 пак. "Стандарт"', sku: 'PAK-BOX-25-S', category: 'packaging_box', unit: 'pcs', minStockLevel: 5000 },
    { id: 'pak-box-25-prem', name: 'Пачка 25 пак. "Премиум"', sku: 'PAK-BOX-25-P', category: 'packaging_box', unit: 'pcs', minStockLevel: 3000 },
    { id: 'pak-box-100-std', name: 'Пачка 100 пак. "Стандарт"', sku: 'PAK-BOX-100-S', category: 'packaging_box', unit: 'pcs', minStockLevel: 2000 },
    { id: 'pak-box-100-fam', name: 'Пачка 100 пак. "Семейная"', sku: 'PAK-BOX-100-F', category: 'packaging_box', unit: 'pcs', minStockLevel: 1000 },
    { id: 'pak-box-pyr-20', name: 'Пачка 20 пирамидок', sku: 'PAK-BOX-PYR-20', category: 'packaging_box', unit: 'pcs', minStockLevel: 2000 },

    // --- PACKAGING: CRATES (6-8 types) ---
    { id: 'crt-std-20', name: 'Гофрокороб (20 пачек)', sku: 'CRT-STD-20', category: 'packaging_crate', unit: 'pcs', minStockLevel: 1000 },
    { id: 'crt-std-40', name: 'Гофрокороб (40 пачек)', sku: 'CRT-STD-40', category: 'packaging_crate', unit: 'pcs', minStockLevel: 1000 },
    { id: 'crt-lrg-100', name: 'Гофрокороб Большой (100 пачек)', sku: 'CRT-LRG-100', category: 'packaging_crate', unit: 'pcs', minStockLevel: 500 },
    { id: 'crt-uni-s', name: 'Гофрокороб Универсальный S', sku: 'CRT-UNI-S', category: 'packaging_crate', unit: 'pcs', minStockLevel: 500 },
    { id: 'crt-uni-m', name: 'Гофрокороб Универсальный M', sku: 'CRT-UNI-M', category: 'packaging_crate', unit: 'pcs', minStockLevel: 500 },
    { id: 'crt-uni-l', name: 'Гофрокороб Универсальный L', sku: 'CRT-UNI-L', category: 'packaging_crate', unit: 'pcs', minStockLevel: 300 },
    { id: 'crt-export', name: 'Гофрокороб Экспортный (Усиленный)', sku: 'CRT-EXP', category: 'packaging_crate', unit: 'pcs', minStockLevel: 200 },

    // --- LABELS ---
    { id: 'lbl-box', name: 'Наклейка на пачку (Термо)', sku: 'LBL-BOX', category: 'label', unit: 'pcs', minStockLevel: 10000 },
    { id: 'lbl-crate', name: 'Этикетка на ящик (Транспортная)', sku: 'LBL-CRT', category: 'label', unit: 'pcs', minStockLevel: 2000 },
    { id: 'lbl-batik-green', name: 'Этикетка Batik Green', sku: 'LBL-BTK-GRN', category: 'label', unit: 'pcs', minStockLevel: 5000 },
    { id: 'lbl-batik', name: 'Этикетка Batik', sku: 'LBL-BTK-STD', category: 'label', unit: 'pcs', minStockLevel: 5000 },
    { id: 'lbl-askold', name: 'Этикетка Askold', sku: 'LBL-ASK', category: 'label', unit: 'pcs', minStockLevel: 5000 },
    { id: 'lbl-homely', name: 'Этикетка Домашний', sku: 'LBL-HML', category: 'label', unit: 'pcs', minStockLevel: 5000 },
];

// Generate initial stock levels
export const MOCK_STOCK: StockLevel[] = MOCK_ITEMS.flatMap(item => {
    // Distribute stock across warehouses roughly
    return [
        {
            id: `stk-${item.id}-main`,
            warehouseId: 'wh-main',
            itemId: item.id,
            quantity: Math.floor(Math.random() * 1000) + item.minStockLevel, // Ensure most are in stock
            lastUpdated: new Date().toISOString()
        },
        // Some items in production buffer
        ...(Math.random() > 0.7 ? [{
            id: `stk-${item.id}-prod`,
            warehouseId: 'wh-prod-1',
            itemId: item.id,
            quantity: Math.floor(Math.random() * 50),
            lastUpdated: new Date().toISOString()
        }] : [])
    ];
});
