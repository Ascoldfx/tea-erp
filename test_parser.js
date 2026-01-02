
// Mock the function from excelParser.ts to test it in isolation
const parseStockValueStrict = (
    val,
    unit = '',
    category = '',
    itemName = ''
) => {
    if (val === undefined || val === null || val === '') return null;
    let str = String(val).trim();
    if (str === '-') return 0;

    // Normalize inputs
    const unitLower = unit.toLowerCase().trim();
    const categoryLower = category.toLowerCase().trim();
    const nameLower = itemName.toLowerCase().trim();

    // Remove spaces (common thousand separators)
    str = str.replace(/\s/g, '');

    // CHECK FOR INTEGER MODE
    // If an item is counted in pieces (шт/pcs) OR is a known integer type (label, sticker, envelope, box),
    // it physically cannot have decimal places.
    // Therefore, any dots or commas are strictly thousand separators (except maybe comma if someone wrote "1,5 pcs" which is weird but we can handle it).
    // In UA/RU locale: "1.234" usually means 1234.
    const isIntegerType =
        unitLower === 'шт' ||
        unitLower === 'pcs' ||
        unitLower === 'штук' ||
        categoryLower === 'label' ||
        categoryLower === 'sticker' ||
        categoryLower === 'envelope' ||
        categoryLower === 'packaging_cardboard' || // Boxes
        nameLower.includes('ярлик') ||
        nameLower.includes('стикер') ||
        nameLower.includes('конверт');

    console.log(`Input: "${val}", Unit: "${unit}", Cat: "${category}" => IsInteger: ${isIntegerType}`);

    if (isIntegerType) {
        // AGGRESSIVE INTEGER PARSING
        // Remove ALL dots. They are thousand separators.
        // Replace comma with dot (just in case it's "1,5" -> 1.5, though unlikely for integers).
        // Actually, for strict integers, we might want to just strip everything non-numeric except maybe a negative sign?
        // But let's stick to the specific fix: "dots are separators".

        str = str.replace(/\./g, ''); // "2.124" -> "2124"
        str = str.replace(',', '.');  // "2124,5" -> "2124.5" (if valid)
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
            // Single dot and NO comma. Ambiguous.
            // "1.500" -> could be 1500 or 1.5
            // Default for non-integer types is usually float (1.5).
            // No change needed, parseFloat handles "1.500" as 1.5
        }
    }

    const num = parseFloat(str);
    return isNaN(num) ? null : num;
};

// Test Cases
console.log('--- TEST START ---');
console.log('2.124 (label):', parseStockValueStrict('2.124', 'шт', 'label', 'Label Item'));
console.log('1.551 (label):', parseStockValueStrict('1.551', 'шт', 'label', 'Label Item'));
console.log('2.124.770 (label):', parseStockValueStrict('2.124.770', 'шт', 'label', 'Label Item'));
console.log('1.500 (kg):', parseStockValueStrict('1.500', 'kg', 'tea_bulk', 'Tea Item'));
console.log('--- TEST END ---');
