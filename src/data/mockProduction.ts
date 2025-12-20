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

// Тестовые техкарты удалены - используйте базу данных для хранения техкарт
const RECIPES_LIST: any[] = [];

export const MOCK_RECIPES: Recipe[] = [];

// Production batches - cleared test data
export const MOCK_BATCHES: ProductionBatch[] = [];
