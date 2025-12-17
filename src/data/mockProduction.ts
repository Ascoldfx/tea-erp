import type { Recipe, ProductionBatch } from '../types/production';

// Helper to create ingredients easily
const ingredient = (id: string, qty: number) => ({ itemId: id, quantity: qty });

// Base Consumption for 1000 tea bags (Standard Batch)
// Tea: 2g * 1000 = 2kg
// Flavor: ~0.05 L (50ml) per 1000 packs (varies)
// Thread: 200m
// Tag: 1000 pcs
// Filter: 0.2kg (approx)
// Box (25pk): 40 boxes
// Crate: 2 crates (20 boxes each)
// Labels: 40 box labels + 2 crate labels
const BASE_PACKAGING = [
    ingredient('mat-thread', 1000), // using pcs/meters unit 1:1 for simplicity or specific logic
    ingredient('mat-tag', 1000),
    ingredient('mat-filter', 0.2), // kg
    ingredient('pak-box-25', 40),
    ingredient('lbl-box', 40),
    ingredient('crt-std', 2),
    ingredient('lbl-crate', 2)
];

const RECIPES_LIST = [
    { id: 'rcp-001', name: 'Чай Черный "Классика" (25 пак)', tea: 'tea-001', flavor: null },
    { id: 'rcp-002', name: 'Чай Зеленый "Сенча" (25 пак)', tea: 'tea-002', flavor: null },
    { id: 'rcp-003', name: 'Эрл Грей (25 пак)', tea: 'tea-003', flavor: 'flv-001' },
    { id: 'rcp-004', name: 'Альпийские Травы (25 пак)', tea: 'tea-004', flavor: null }, // Herbal blend
    { id: 'rcp-005', name: 'Лесные Ягоды (25 пак)', tea: 'tea-005', flavor: 'flv-006' }, // Strawberry
    { id: 'rcp-006', name: 'Черный с Лимоном (25 пак)', tea: 'tea-001', flavor: 'flv-002' },
    { id: 'rcp-007', name: 'Черный с Мятой (25 пак)', tea: 'tea-001', flavor: 'flv-003' },
    { id: 'rcp-008', name: 'Черный с Чабрецом (25 пак)', tea: 'tea-001', flavor: 'flv-019' },
    { id: 'rcp-009', name: 'Зеленый с Жасмином (25 пак)', tea: 'tea-002', flavor: 'flv-004' },
    { id: 'rcp-010', name: 'Зеленый с Лимоном (25 пак)', tea: 'tea-002', flavor: 'flv-002' },
    { id: 'rcp-011', name: 'Зеленый с Мятой (25 пак)', tea: 'tea-002', flavor: 'flv-003' },
    { id: 'rcp-012', name: 'Чай "Рождественский" (25 пак)', tea: 'tea-001', flavor: 'flv-010' }, // Cinnamon
    { id: 'rcp-013', name: 'Чай "Имбирный Пряник" (25 пак)', tea: 'tea-001', flavor: 'flv-011' }, // Ginger
    { id: 'rcp-014', name: 'Чай "Медовый" (25 пак)', tea: 'tea-001', flavor: 'flv-012' }, // Honey
    { id: 'rcp-015', name: 'Чай "Ванильное Небо" (25 пак)', tea: 'tea-001', flavor: 'flv-005' }, // Vanilla
    { id: 'rcp-016', name: 'Чай "Тропик" (25 пак)', tea: 'tea-002', flavor: 'flv-009' }, // Mango
    { id: 'rcp-017', name: 'Чай "Цитрусовый Микс" (25 пак)', tea: 'tea-002', flavor: 'flv-016' }, // Orange
    { id: 'rcp-018', name: 'Чай "Ягодный Десерт" (25 пак)', tea: 'tea-005', flavor: 'flv-007' }, // Raspberry
    { id: 'rcp-019', name: 'Чай "Персиковый Сад" (25 пак)', tea: 'tea-001', flavor: 'flv-008' }, // Peach
    { id: 'rcp-020', name: 'Чай "Шоколадный Трюфель" (25 пак)', tea: 'tea-001', flavor: 'flv-013' } // Chocolate
];

export const MOCK_RECIPES: Recipe[] = RECIPES_LIST.map(r => ({
    id: r.id,
    name: r.name,
    description: `Технологическая карта для производства 1000 пакетиков (40 пачек). Основа: ${r.tea}.`,
    outputItemId: 'finished-good-mock-id',
    outputQuantity: 1000, // packs
    ingredients: [
        ingredient(r.tea, 2), // 2kg tea base
        ...(r.flavor ? [ingredient(r.flavor, 0.05)] : []), // 50ml flavor if present
        ...BASE_PACKAGING
    ]
}));

// Production batches - cleared test data
export const MOCK_BATCHES: ProductionBatch[] = [];
