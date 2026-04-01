/**
 * Shared unit display helper. Used in InventoryList, OrdersList, etc.
 * Returns a localised unit string (e.g. 'кг', 'шт', 'л') based on category and raw DB unit.
 */

const KG_CATEGORIES = [
    'tea_bulk',
    'flavor',
    'packaging_consumable',
    'raw_material',
    'semi_finished',
    'blend',
];

function normalizeCategory(cat: string): string {
    if (!cat) return 'other';
    const lower = cat.toLowerCase().trim();
    if (lower === 'арри' || lower === 'arri' || lower === 'ароматизатори' || lower === 'ароматизаторы') return 'flavor';
    return cat;
}

export function getDisplayUnit(item: { unit?: string | null; category?: string | null }): string {
    const cat = normalizeCategory(item.category || '').toLowerCase();

    if (
        KG_CATEGORIES.includes(cat) ||
        cat.includes('сырье') || cat.includes('сировин') ||
        cat.includes('н/ф') || cat.includes('нф') ||
        cat.includes('купаж') || cat.includes('blend') ||
        cat.includes('пленк') || cat.includes('плівк')
    ) {
        return 'кг';
    }

    const u = (item.unit || '').toLowerCase();
    if (u === 'pcs' || u === 'шт' || u === 'pc' || u === 'pieces') return 'шт';
    if (u === 'kg' || u === 'кг') return 'кг';
    if (u === 'l' || u === 'л' || u === 'litre' || u === 'liter') return 'л';
    if (u === 'g' || u === 'г' || u === 'gram') return 'г';
    return u || 'шт'; // fallback to 'шт' if empty
}
