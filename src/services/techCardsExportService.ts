import * as XLSX from 'xlsx';
import type { Recipe } from '../types/production';
import type { InventoryItem, PlannedConsumption } from '../types/inventory';

interface TechCardExportRow {
    'Артикул ГП': string;
    'Назва ГП': string;
    'Група КСМ': string;
    'Артикул КСМ': string;
    'Назва КСМ': string;
    'Од. вим.': string;
    'Еталон': number;
    [key: string]: string | number; // Динамические столбцы с датами и месяцами
}

interface MonthData {
    date: string; // YYYY-MM-DD format (1st of month)
    monthName: string; // "Январь 2026"
    dateFormatted: string; // "01.01.2026"
}

/**
 * Преобразует единицу измерения в читаемый формат для Excel
 */
function formatUnit(unit: string | undefined): string {
    if (!unit) return 'шт';

    const unitMap: Record<string, string> = {
        'pcs': 'шт',
        'шт': 'шт',
        'kg': 'кг',
        'g': 'г',
        'l': 'л',
        'ml': 'мл'
    };

    return unitMap[unit.toLowerCase()] || unit;
}

/**
 * Генерирует список месяцев для экспорта
 * Начинает с текущего месяца и включает следующие 12 месяцев
 */
function generateMonths(): MonthData[] {
    const months: MonthData[] = [];
    const now = new Date();
    const monthNames = [
        'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
        'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
    ];

    for (let i = 0; i < 14; i++) {
        const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
        const year = date.getFullYear();
        const month = date.getMonth();

        months.push({
            date: `${year}-${String(month + 1).padStart(2, '0')}-01`,
            monthName: `${monthNames[month]} ${year}`,
            dateFormatted: `01.${String(month + 1).padStart(2, '0')}.${year}`
        });
    }

    return months;
}

/**
 * Получает норму материала для конкретного месяца из техкарты
 * В будущем это может быть из базы данных с историей изменений норм
 */
function getNormForMonth(
    ingredient: { itemId: string; quantity: number }
): number {
    // Пока возвращаем стандартную норму из техкарты
    // В будущем можно добавить логику изменения норм по месяцам
    return ingredient.quantity;
}

/**
 * Получает планируемый расход материала на месяц
 */
function getPlannedConsumptionForMonth(
    plannedConsumptions: PlannedConsumption[],
    itemId: string,
    monthDate: string
): number {
    const targetMonth = monthDate.substring(0, 7); // YYYY-MM

    const consumption = plannedConsumptions.find(pc => {
        const pcDate = new Date(pc.plannedDate);
        const pcMonth = `${pcDate.getFullYear()}-${String(pcDate.getMonth() + 1).padStart(2, '0')}`;
        return pc.itemId === itemId && pcMonth === targetMonth;
    });

    return consumption?.quantity || 0;
}

/**
 * Экспортирует техкарты в Excel
 */
export async function exportTechCardsToExcel(
    recipes: Recipe[],
    items: InventoryItem[],
    plannedConsumptions: PlannedConsumption[]
): Promise<void> {
    if (recipes.length === 0) {
        alert('Нет техкарт для экспорта');
        return;
    }

    const months = generateMonths();
    const rows: TechCardExportRow[] = [];

    // Проходим по каждой техкарте
    for (const recipe of recipes) {
        // Получаем информацию о готовой продукции
        const finishedGood = items.find(i => i.id === recipe.outputItemId);
        const gpSku = finishedGood?.sku || recipe.outputItemId;
        const gpName = finishedGood?.name || recipe.name;

        // Проходим по каждому ингредиенту техкарты
        for (const ingredient of recipe.ingredients) {
            const material = items.find(i => i.id === ingredient.itemId);
            if (!material) continue;

            // Создаем базовую строку
            const row: TechCardExportRow = {
                'Артикул ГП': gpSku,
                'Назва ГП': gpName,
                'Група КСМ': material.category || '',
                'Артикул КСМ': material.sku || '',
                'Назва КСМ': material.name || '',
                'Од. вим.': formatUnit(material.unit),
                'Еталон': ingredient.quantity
            };

            // Добавляем столбцы с нормами по месяцам (даты)
            for (const month of months) {
                const norm = getNormForMonth(ingredient);
                row[month.dateFormatted] = norm;
            }

            // Добавляем столбцы с планируемым расходом по месяцам
            for (const month of months) {
                const planned = getPlannedConsumptionForMonth(
                    plannedConsumptions,
                    ingredient.itemId,
                    month.date
                );
                row[month.monthName] = planned;
            }

            rows.push(row);
        }
    }

    // Создаем заголовки столбцов
    const headers = [
        'Артикул ГП',
        'Назва ГП',
        'Група КСМ',
        'Артикул КСМ',
        'Назва КСМ',
        'Од. вим.',
        'Еталон',
        ...months.map(m => m.dateFormatted), // Столбцы с датами (нормы)
        ...months.map(m => m.monthName) // Столбцы с месяцами (планируемый расход)
    ];

    // Создаем массив данных для Excel
    const excelData = [
        headers,
        ...rows.map(row => headers.map(header => row[header] || ''))
    ];

    // Создаем рабочую книгу
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(excelData);

    // Настраиваем ширину столбцов
    const colWidths = [
        { wch: 15 }, // Артикул ГП
        { wch: 30 }, // Назва ГП
        { wch: 15 }, // Група КСМ
        { wch: 15 }, // Артикул КСМ
        { wch: 40 }, // Назва КСМ
        { wch: 10 }, // Од. вим.
        { wch: 10 }, // Еталон
        ...months.map(() => ({ wch: 12 })), // Даты
        ...months.map(() => ({ wch: 15 })) // Месяцы
    ];
    ws['!cols'] = colWidths;

    // Добавляем лист в книгу
    XLSX.utils.book_append_sheet(wb, ws, 'Техкарты');

    // Генерируем имя файла с текущей датой
    const now = new Date();
    const fileName = `Техкарты_${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}.xlsx`;

    // Сохраняем файл
    XLSX.writeFile(wb, fileName);
}

/**
 * Парсит единицу измерения из Excel формата
 */
function parseUnit(unitStr: string | undefined): string {
    if (!unitStr) return 'kg'; // Default to kg as requested

    const unitMap: Record<string, string> = {
        'шт': 'pcs',
        'кг': 'kg',
        'г': 'g',
        'л': 'l',
        'мл': 'ml',
        'pcs': 'pcs',
        'kg': 'kg',
        'g': 'g',
        'l': 'l',
        'ml': 'ml'
    };

    const cleanUnit = unitStr.toLowerCase().trim();
    // If unit is just a number or weird symbol, default to kg? 
    // User said "missing designations kg or pcs, then default kg".
    // If it's explicitly "шт", it becomes "pcs".

    return unitMap[cleanUnit] || 'kg';
}

/**
 * Импортирует техкарты из Excel файла
 */
export interface ImportedTechCard {
    gpSku: string;
    gpName: string;
    ingredients: Array<{
        materialSku: string;
        materialName: string;
        materialCategory: string;
        unit: string;
        norm: number; // Базовая норма (Еталон)
        monthlyNorms?: Array<{ date: string; quantity: number }>; // Нормы по месяцам
    }>;
}

export function parseTechCardsFromExcel(
    workbook: XLSX.WorkBook,
    sheetName: string
): ImportedTechCard[] {
    const ws = workbook.Sheets[sheetName];
    if (!ws) {
        throw new Error(`Лист "${sheetName}" не найден`);
    }

    // Читаем данные как массив массивов
    const rawData = XLSX.utils.sheet_to_json(ws, {
        defval: '',
        raw: false,
        header: 1
    }) as any[][];

    if (!rawData || rawData.length === 0) {
        throw new Error('Файл пуст или не содержит данных');
    }

    // 1. Находим строку заголовков
    let headerRowIndex = -1;
    // Expanded keywords to be more robust (RU + UA)
    const headerKeywords = [
        'артикул гп', 'назва гп', 'название гп', 'артикул', 'name',
        'артикул ксм', 'назва ксм', 'артикул сировини', 'назва сировини', 'код ксм', 'код сировини',
        'эталон', 'еталон', 'норма', 'ingredients', 'компонент', 'сировина', 'матеріал'
    ];

    // Scan deeper - up to 100 rows
    for (let i = 0; i < Math.min(100, rawData.length); i++) {
        const row = rawData[i];
        if (!row) continue;
        const rowText = row.map(cell => String(cell || '').toLowerCase().trim()).join(' ');

        // Count matches to ensure it's a real header row
        const matchCount = headerKeywords.reduce((acc, keyword) => {
            return acc + (rowText.includes(keyword) ? 1 : 0);
        }, 0);

        if (matchCount >= 2) { // Require at least 2 keyword matches
            headerRowIndex = i;
            console.log(`[parseTechCardsFromExcel] Found header row at index ${i} with ${matchCount} matches.`);
            break;
        }
    }

    if (headerRowIndex === -1) {
        // Fallback: try row 0 if nothing found
        console.warn('[parseTechCardsFromExcel] Header row not found by keywords. Defaulting to row 0.');
        headerRowIndex = 0;
    }

    const helperHeaders = rawData[headerRowIndex] || [];
    // Normalize headers: remove newlines, extra spaces, toLowerCase
    const headers = helperHeaders.map((h: any) => String(h || '').replace(/\s+/g, ' ').trim());

    // DEBUG: Dump raw headers and first rows to troubleshoot column indices
    console.log('[parseTechCardsFromExcel] 🔍 PARSER DEBUG 🔍');
    console.log('[parseTechCardsFromExcel] RAW HEADERS (Row ' + headerRowIndex + '):', headers);
    console.log('[parseTechCardsFromExcel] HARDCODED INDICES: GP_SKU=0, MAT_SKU=3');
    console.log('[parseTechCardsFromExcel] FIRST 3 RAW ROWS:', rawData.slice(headerRowIndex + 1, headerRowIndex + 4));


    // DYNAMIC COLUMN DETECTION
    // We search for known keywords in the normalized 'headers' array.
    const findCol = (keywords: string[], defaultIdx: number): number => {
        const idx = headers.findIndex(h => keywords.some(k => h.includes(k)));
        return idx !== -1 ? idx : defaultIdx;
    };

    const gpSkuIndex = findCol(['артикул гп', 'код гп', 'gp sku', 'артикул', 'sku'], 0);
    const gpNameIndex = findCol(['назва гп', 'название гп', 'gp name', 'продукция', 'назва', 'name'], 1);
    const materialCategoryIndex = findCol(['група ксм', 'категория', 'category', 'група', 'group'], 2);
    const materialSkuIndex = findCol(['артикул ксм', 'код ксм', 'код компонента', 'sku', 'art', 'артикул сировини', 'код сировини', 'артикул матеріалу', 'код матеріалу'], 3);
    const materialNameIndex = findCol(['назва ксм', 'название ксм', 'компонент', 'материал', 'name', 'назва сировини', 'назва матеріалу', 'сировина', 'матеріал'], 4);
    const unitIndex = findCol(['од. вим.', 'ед. изм.', 'unit', 'од.', 'ед.'], 5);
    const normIndex = findCol(['еталон', 'норма', 'norm', 'quantity', 'кількість'], 6);

    console.log('[parseTechCardsFromExcel] DYNAMIC COLUMN DETECTION:', {
        gpSkuIndex,
        gpNameIndex,
        materialCategoryIndex,
        materialSkuIndex,
        materialNameIndex,
        unitIndex,
        normIndex
    });

    // 3. Предварительно находим колонки с датами (для месячных норм)
    // Это оптимизация: ищем паттерны дат ОДИН раз, а не для каждой строки
    const datePattern = /(\d{1,2})[\.\/\-\s](\d{1,2})[\.\/\-\s](\d{4})/; // DD.MM.YYYY
    const datePatternShort = /(\d{1,2})[\.\/\-\s](\d{1,2})[\.\/\-\s](\d{2})/; // DD.MM.YY
    const dateColumnIndices: { index: number; dateIso: string }[] = [];

    headers.forEach((header, idx) => {
        // Пропускаем основные колонки, чтобы не путать даты с "Артикул 2023"
        // Hardcoded indices 0-6
        if (idx <= 6) return;

        // Попытка распарсить как Excel Serial Date (если заголовок число)
        const rawHeader = helperHeaders[idx];
        let headerStr = header;

        if (typeof rawHeader === 'number' && rawHeader > 35000 && rawHeader < 60000) {
            try {
                const date = XLSX.SSF.parse_date_code(rawHeader);
                if (date) headerStr = `${String(date.d).padStart(2, '0')}.${String(date.m).padStart(2, '0')}.${date.y}`;
            } catch (e) { }
        }

        // Парсинг строки даты
        let day, month, year;
        const matchFull = headerStr.match(datePattern);
        const matchShort = headerStr.match(datePatternShort);

        if (matchFull) {
            [, day, month, year] = matchFull.map(Number);
        } else if (matchShort) {
            [, day, month, year] = matchShort.map(Number);
            year += 2000;
        }

        if (day && month && year && day >= 1 && day <= 31 && month >= 1 && month <= 12) {
            // Нормализуем к 1 числу: YYYY-MM-01
            const dateIso = `${year}-${String(month).padStart(2, '0')}-01`;
            dateColumnIndices.push({ index: idx, dateIso });
        }
    });

    console.log(`[parseTechCardsFromExcel] Detected ${dateColumnIndices.length} date columns for monthly norms.`);

    console.log('[Parser] Detected Columns (Static):', { gpSkuIndex, gpNameIndex, materialSkuIndex, materialNameIndex, unitIndex });

    // 4. Парсим строки
    // Map<OriginalSKU, Array<{name: string, assignedSku: string}>>
    // const skuVariationsMap = new Map<string, Array<{ name: string, assignedSku: string }>>();

    let lastTechCard: ImportedTechCard | null = null;
    const result: ImportedTechCard[] = [];

    // Используем rawData напрямую
    for (let i = headerRowIndex + 1; i < rawData.length; i++) {
        const row = rawData[i];
        if (!row || row.length === 0) continue;

        // Declare current pointer for this row
        let currentTechCard: ImportedTechCard | null = null;

        // Безопасное чтение ячеек: поддерживает примитивы и объекты (если sheet_to_json вернул raw объекты)
        const getCell = (idx: number): string => {
            if (idx < 0 || row[idx] === undefined || row[idx] === null) return '';
            const cell = row[idx];
            if (typeof cell === 'object' && cell !== null) {
                // Если это объект ячейки с полями v (value), w (formatted text)
                return String((cell as any).w || (cell as any).v || '').trim();
            }
            return String(cell).trim();
        };

        // 3. Извлекаем данные c безопасным TRIM
        const gpSku = getCell(gpSkuIndex) || undefined;
        const gpName = getCell(gpNameIndex) || undefined;

        const materialSku = getCell(materialSkuIndex) || undefined;
        const materialName = getCell(materialNameIndex) || undefined;

        // DEBUG: Verbose logging for problematic rows
        if (gpSku?.includes('282085') || materialSku?.includes('2010331') || i < 15) {
            // ... existing logs ...
        }

        // Пропускаем совсем пустые
        if (!gpSku && !gpName && !materialSku && !materialName) {
            // ... existing skipped logic ...
            continue;
        }

        // Определяем ТехКарту (Parent)
        const hasGpInfo = !!gpSku;

        if (hasGpInfo) {
            let finalSku = gpSku || '';

            // Create a new fragment for every row that has GP info.
            // We rely on Post-Processing Merge to consolidate duplicates.
            currentTechCard = {
                gpSku: finalSku,
                gpName: gpName || 'Без названия',
                ingredients: []
            };
            result.push(currentTechCard);
            lastTechCard = currentTechCard;
        } else if (lastTechCard) {
            // Continuation row
            currentTechCard = lastTechCard;
        } else {
            // Orphan
            continue;
        }

        // Если это строка с материалом
        if (materialSku || materialName) {
            const unit = getCell(unitIndex) || 'kg';

            // Парсинг Базовой Нормы
            let normVal = 0;
            // Enhanced Norm Parsing Debug
            const rawNorm = normIndex >= 0 ? row[normIndex] : undefined;

            if (rawNorm !== undefined) {
                // Remove spaces and replace comma
                const valStr = String(rawNorm).replace(',', '.').replace(/\s/g, '');
                const parsed = parseFloat(valStr);

                if (!isNaN(parsed)) {
                    normVal = Math.max(0, parsed);
                }
            }
            // Removed unreachable check for normIndex === -1 (hardcoded to 6)

            // START DEBUG for SKU 262178 (User Reported Issue)
            if ((gpSku && gpSku.includes('262178')) || (gpName && gpName.includes('262178')) || (lastTechCard && lastTechCard.gpSku.includes('262178'))) {
                const rawRowStr = JSON.stringify(row);
                console.log(`[DEBUG 262178] Row ${i} (Length: ${row.length}):`, {
                    gpSku,
                    materialSku,
                    normIndex,
                    normHeader: headers[normIndex], // Check what header we think is Norm
                    normRawThisRow: rawNorm,
                    normParsed: normVal,
                    rawRow: rawRowStr
                });
            }
            // END DEBUG

            // Парсинг Месячных норм
            const monthlyNorms: Array<{ date: string; quantity: number }> = [];
            dateColumnIndices.forEach(({ index, dateIso }) => {
                if (index < row.length && row[index] !== undefined) {
                    const valStr = String(row[index]).replace(',', '.').replace(/\s/g, '');
                    const parsed = parseFloat(valStr);
                    if (!isNaN(parsed) && parsed > 0) { // Храним только ненулевые нормы для экономии
                        monthlyNorms.push({ date: dateIso, quantity: Math.max(0, parsed) });
                    }
                }
            });

            // LOGGING FIRST 5 ROWS DETAILED
            if (i < headerRowIndex + 5) {
                console.log(`[parseTechCardsFromExcel] Row ${i} Debug:`, {
                    material: materialName || materialSku,
                    normIdx: normIndex,
                    normRaw: rawNorm,
                    normParsed: normVal,
                    monthlyCount: monthlyNorms.length
                });
            }

            // Добавляем ингредиент
            const newIngredient = {
                materialSku: materialSku || '',
                materialName: materialName || materialSku || 'Ингредиент',
                materialCategory: getCell(materialCategoryIndex),
                unit: parseUnit(unit),
                norm: normVal,
                monthlyNorms: monthlyNorms.length > 0 ? monthlyNorms : undefined
            };

            // Dedupe check INSIDE current card only
            const existingIng = currentTechCard.ingredients.find(ing =>
                (ing.materialSku && ing.materialSku === newIngredient.materialSku) ||
                (ing.materialName === newIngredient.materialName)
            );

            if (existingIng) {
                // If duplicates within same block (e.g. split norms), sum them?
                // Or overwrite? Usually split norms -> sum.
                // But let's just push ensuring unique identifiers later?
                // For now, let's SUM norms if match found.
                existingIng.norm += newIngredient.norm;
                // Add monthly norms? Too complex to merge arrays, just keep first.
            } else {
                currentTechCard.ingredients.push(newIngredient);
            }
        }

        // START DEBUG for SKU 262178
        if ((gpSku && gpSku.includes('262178')) || (gpName && gpName.includes('262178')) || (lastTechCard && lastTechCard.gpSku.includes('262178'))) {
            // ... debug log ...
        }
    }

    // Push last
    if (result.length === 0 && lastTechCard) {
        // logic fix: lastTechCard references currentTechCard? 
        // result is array. lastTechCard IS currentTechCard usually.
        // Wait, currentTechCard was pushed when swiching.
        // The VERY LAST one wasn't pushed.
        result.push(lastTechCard);
    } else if (lastTechCard && result[result.length - 1] !== lastTechCard) {
        result.push(lastTechCard);
    }

    // 6. POST-PROCESSING: MERGE BY SKU
    const finalMap = new Map<string, ImportedTechCard>();

    result.forEach(card => {
        const sku = card.gpSku.trim(); // Ensure trim again
        if (!finalMap.has(sku)) {
            finalMap.set(sku, card);
        } else {
            const pattern = finalMap.get(sku)!;
            // Update Name if better
            if (pattern.gpName === 'Без названия' && card.gpName !== 'Без названия') {
                pattern.gpName = card.gpName;
            }
            // Merge Ingredients
            card.ingredients.forEach(ing => {
                const existing = pattern.ingredients.find(i =>
                    (i.materialSku && i.materialSku === ing.materialSku) ||
                    (i.materialName === ing.materialName)
                );
                if (existing) {
                    existing.norm += ing.norm;
                    // Merge monthly?
                } else {
                    pattern.ingredients.push(ing);
                }
            });
        }
    });

    const mergedCards = Array.from(finalMap.values());
    console.log(`[parseTechCardsFromExcel] Merged ${result.length} blocks into ${mergedCards.length} unique tech cards.`);

    return mergedCards;
};


