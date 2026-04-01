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

/** Categories where price is quoted per 1000 pieces (ярлыки, стикеры) */
const PER_THOUSAND_CATEGORIES = ['label', 'sticker'];

/** Categories priced per piece */
const PER_PCS_CATEGORIES = ['packaging_crate', 'packaging_cardboard', 'envelope', 'soft_packaging'];

function normalizeCategory(cat: string): string {
    if (!cat) return 'other';
    const lower = cat.toLowerCase().trim();
    if (lower === 'арри' || lower === 'arri' || lower === 'ароматизатори' || lower === 'ароматизаторы') return 'flavor';
    return cat;
}

function isKgCategory(cat: string): boolean {
    return (
        KG_CATEGORIES.includes(cat) ||
        cat.includes('сырье') || cat.includes('сировин') ||
        cat.includes('н/ф') || cat.includes('нф') ||
        cat.includes('купаж') || cat.includes('blend') ||
        cat.includes('пленк') || cat.includes('плівк') ||
        cat.includes('нитк') || cat.includes('нитч') || // нитка
        cat.includes('wire') || cat.includes('провол')  // проволока
    );
}

export function getDisplayUnit(item: { unit?: string | null; category?: string | null }): string {
    const cat = normalizeCategory(item.category || '').toLowerCase();

    if (isKgCategory(cat)) return 'кг';

    const u = (item.unit || '').toLowerCase();
    if (u === 'pcs' || u === 'шт' || u === 'pc' || u === 'pieces') return 'шт';
    if (u === 'kg' || u === 'кг') return 'кг';
    if (u === 'l' || u === 'л' || u === 'litre' || u === 'liter') return 'л';
    if (u === 'g' || u === 'г' || u === 'gram') return 'г';
    return u || 'шт';
}

/**
 * Returns the pricing unit label for a given material category.
 * Used in order modals to hint the user on pricing convention.
 *
 * Rules:
 *   - Ярлыки / Стикеры → за 1000 шт
 *   - Ароматизаторы, чайное сырьё, пленки, нитка, проволока → за кг
 *   - Ящики, картонная упаковка, конверты → за шт
 *   - Всё остальное → за шт
 */
export function getPricingUnit(item: { unit?: string | null; category?: string | null }): {
    label: string;   // e.g. 'за 1000 шт', 'за кг', 'за шт'
    multiplier: number; // 1000 for labels, 1 otherwise – use for total calc if needed
} {
    const cat = normalizeCategory(item.category || '').toLowerCase();

    if (PER_THOUSAND_CATEGORIES.includes(cat)) {
        return { label: 'за 1000 шт', multiplier: 1000 };
    }

    if (isKgCategory(cat)) {
        return { label: 'за кг', multiplier: 1 };
    }

    if (PER_PCS_CATEGORIES.some(c => cat.includes(c) || c.includes(cat))) {
        return { label: 'за шт', multiplier: 1 };
    }

    // Fallback: use display unit
    return { label: `за ${getDisplayUnit(item)}`, multiplier: 1 };
}
