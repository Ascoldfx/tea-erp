
/**
 * Strict parser for stock values from Excel (v2.8 RADICAL FIX).
 * Solves the ambiguity between "1.500" (1.5 kg) and "1.500" (1500 pcs)
 * by forcing integer mode for specific units/categories and stripping all non-digits.
 */
export const parseStockValueStrict = (
    val: any,
    unit: string = '',
    category: string = '',
    itemName: string = ''
): number | null => {
    if (val === undefined || val === null || val === '') return null;
    let str = String(val).trim();
    if (str === '-') return 0; // Sometimes '-' means 0

    // Normalize inputs safely (v2.5 fix)
    const unitLower = String(unit || '').toLowerCase().trim();
    const categoryLower = String(category || '').toLowerCase().trim();
    const nameLower = String(itemName || '').toLowerCase().trim();

    // Remove spaces (common thousand separators)
    str = str.replace(/\s/g, '');

    // CHECK FOR INTEGER MODE (Regex for safety - v2.6)
    const isIntegerType =
        /шт|pcs|штук|od|од/i.test(unitLower) ||
        /label|sticker|sticker|envelope|box|картон|ярлик|стикер|конверт/i.test(categoryLower) ||
        /ярлик|стикер|конверт/i.test(nameLower);

    // Debug specific values to catch edge cases
    if (val && (String(val).includes('1.551') || String(val).includes('2.124') || String(val).includes('2,124'))) {
        console.log(`[PARSER v2.8] Val: "${val}", Unit: "${unitLower}", Cat: "${categoryLower}" => IntMode: ${isIntegerType}`);
    }

    if (isIntegerType) {
        // RADICAL INTEGER PARSING (v2.8)
        // If it's pieces/labels, it CANNOT be a float.
        // We strip everything that is not a digit (or minus sign).
        // "2.124" -> "2124"
        // "2,124" -> "2124"
        // "2 124" -> "2124"
        str = str.replace(/[^0-9-]/g, '');
    } else {
        // STANDARD FLOAT PARSING (for kg, liters, meters)
        // Here, logic is trickier:
        // "1.500" -> 1.5
        // "1.500.000" -> 1500000

        const dotCount = (str.match(/\./g) || []).length;
        const hasComma = str.includes(',');

        if (hasComma) {
            // Comma is the decimal separator (Standard UA/RU)
            // "1.500,50" -> 1500.50
            str = str.replace(/\./g, '').replace(',', '.');
        } else if (dotCount > 1) {
            // Multiple dots -> definitely thousand separators
            // "1.500.000" -> 1500000
            str = str.replace(/\./g, '');
        } else {
            // Single dot and NO comma. Ambiguous ("1.500").
            // Default for non-integer types is Float (1.5).
            // No change needed, parseFloat handles "1.500" as 1.5
        }
    }

    const num = parseFloat(str);
    return isNaN(num) ? null : num;
};
