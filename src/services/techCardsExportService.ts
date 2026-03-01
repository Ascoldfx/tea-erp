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
    }) as unknown[][];

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
    const headers = helperHeaders.map((h) => String(h || '').replace(/\s+/g, ' ').trim());

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
    const datePattern = /(\d{1,2})[./\-\s](\d{1,2})[./\-\s](\d{4})/; // DD.MM.YYYY
    const datePatternShort = /(\d{1,2})[./\-\s](\d{1,2})[./\-\s](\d{2})/; // DD.MM.YY
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
            } catch {
                // Ignore parsing errors for date conversion 
            }
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

    // State for dynamic columns (initially set to detected values)
    let currentIndices = {
        gpSku: gpSkuIndex,
        gpName: gpNameIndex,
        materialCategory: materialCategoryIndex,
        materialSku: materialSkuIndex,
        materialName: materialNameIndex,
        unit: unitIndex,
        norm: normIndex,
        monthIndices: dateColumnIndices
    };

    // Helper to update indices based on a new header row
    const updateIndices = (row: unknown[]) => {
        const rowHeaders = row.map(h => String(h || '').replace(/\s+/g, ' ').trim());

        // Local find helper
        const find = (keywords: string[]) => {
            return rowHeaders.findIndex(h => keywords.some(k => h.includes(k)));
        };

        const newIndices = {
            gpSku: find(['артикул гп', 'код гп', 'gp sku', 'артикул', 'sku']),
            gpName: find(['назва гп', 'название гп', 'gp name', 'продукция', 'назва', 'name']),
            materialCategory: find(['група ксм', 'категория', 'category', 'група', 'group']),
            materialSku: find(['артикул ксм', 'код ксм', 'код компонента', 'sku', 'art', 'артикул сировини', 'код сировини', 'артикул матеріалу', 'код матеріалу']),
            materialName: find(['назва ксм', 'название ксм', 'компонент', 'материал', 'name', 'назва сировини', 'назва матеріалу', 'сировина', 'матеріал']),
            unit: find(['од. вим.', 'ед. изм.', 'unit', 'од.', 'ед.']),
            norm: find(['еталон', 'норма', 'norm', 'quantity', 'кількість']),
            monthIndices: [] as { index: number; dateIso: string }[]
        };

        // Re-detect month columns for this section pattern
        // (Similar logic to initial detection but for current row)
        // For simplicity, reusing strict keywords based detection might be complex inline.
        // Assuming month columns are > normIndex?
        // Let's implement a quick date scan for the new row indices
        const datePattern = /(\d{1,2})[./\-\s](\d{1,2})[./\-\s](\d{4})/; // DD.MM.YYYY
        const datePatternShort = /(\d{1,2})[./\-\s](\d{1,2})[./\-\s](\d{2})/; // DD.MM.YY

        rowHeaders.forEach((header, idx) => {
            // Skip core columns to define date range safely
            if (idx <= 6) return; // Approximate check

            const headerStr = header;
            // Date parsing simplified here (just string match)
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
                const dateIso = `${year}-${String(month).padStart(2, '0')}-01`;
                newIndices.monthIndices.push({ index: idx, dateIso });
            }
        });


        // Only update if we found critical columns causing a valid shift
        if (newIndices.materialSku !== -1 || newIndices.materialName !== -1) {
            console.log('[parseTechCardsFromExcel] 🔄 DETECTED NEW HEADER ROW. UPDATING INDICES:', newIndices);
            currentIndices = newIndices;
            return true;
        }
        return false;
    };


    let lastTechCard: ImportedTechCard | null = null;
    const result: ImportedTechCard[] = [];

    // Используем rawData напрямую
    for (let i = headerRowIndex + 1; i < rawData.length; i++) {
        const row = rawData[i];
        if (!row || row.length === 0) continue;

        // CHECK FOR NEW HEADER: 
        const rowText = row.map((c) => String(c || '').toLowerCase()).join(' ');
        const keywordMatches = headerKeywords.reduce((acc, k) => acc + (rowText.includes(k) ? 1 : 0), 0);

        if (keywordMatches >= 2) { // Relaxed confidence to catch smaller tables
            const updated = updateIndices(row);
            if (updated) {
                continue; // Skip the header row itself
            }
        }

        const getCell = (idx: number): string => {
            if (idx < 0 || row[idx] === undefined || row[idx] === null) return '';
            const cell = row[idx];
            if (typeof cell === 'object' && cell !== null) {
                return String((cell as Record<string, unknown>).w || (cell as Record<string, unknown>).v || '').trim();
            }
            return String(cell).trim();
        };

        // Use currentIndices
        const gpSku = getCell(currentIndices.gpSku);
        const gpName = getCell(currentIndices.gpName);
        const materialCategory = getCell(currentIndices.materialCategory);
        let materialSku = getCell(currentIndices.materialSku);
        let materialName = getCell(currentIndices.materialName);
        const unit = getCell(currentIndices.unit);
        let rawNorm = getCell(currentIndices.norm);

        // SMART NEIGHBOR SEARCH (Fuzzy Fetch)
        // If Material Name is present but SKU is missing, look left/right
        if (materialName && !materialSku) {
            const left = getCell(currentIndices.materialSku - 1);
            const right = getCell(currentIndices.materialSku + 1);
            // Simple heuristic: SKU is usually numeric or short alphanumeric
            // Avoid grabbing names or units.
            if (left && left.length < 15 && /\d/.test(left)) {
                console.log(`[Parser] 🔦 Found SKU in LEFT neighbor for ${materialName}: ${left}`);
                materialSku = left;
            } else if (right && right.length < 15 && /\d/.test(right)) {
                console.log(`[Parser] 🔦 Found SKU in RIGHT neighbor for ${materialName}: ${right}`);
                materialSku = right;
            }
        }

        // SMART NORM SEARCH
        // If Norm is empty, check right (sometimes unit/norm swapped)
        if (!rawNorm || rawNorm === '0') {
            const right = getCell(currentIndices.norm + 1);
            const left = getCell(currentIndices.norm - 1);
            // Look for numeric-ish string
            if (right && /^\d+([.,]\d+)?$/.test(right)) {
                rawNorm = right;
            } else if (left && /^\d+([.,]\d+)?$/.test(left)) {
                rawNorm = left;
            }
        }

        // NUCLEAR FALLBACK: If we still have no Material Name/SKU, but row has content
        if ((!materialName || !materialSku) && row.some((c) => c && String(c).trim().length > 0)) {
            const rowStrings = row.map((c) => String(c || '').trim());
            const textCells = rowStrings.filter(s => s.length > 3 && isNaN(Number(s.replace(',', '.'))));
            const numCells = rowStrings.filter(s => /^\d+([.,]\d+)?$/.test(s));

            // Heuristic: The longest text cell is likely the Match Name (if not GP Name)
            // The numeric cells are likely SKU or Norm.

            if (!materialName && textCells.length > 0) {
                // Exclude GP Name from candidates if known
                const candidate = textCells.find(t => t !== gpName && t !== gpSku);
                if (candidate) {
                    // console.log(`[Parser] ☢️ Nuclear Match for Name: ${candidate}`);
                    materialName = candidate;
                }
            }

            if (!materialSku && numCells.length > 0) {
                // SKU is usually an integer-like string, Norm is decimal
                const skuCandidate = numCells.find(n => n.length >= 4 && !n.includes('.'));
                if (skuCandidate) {
                    materialSku = skuCandidate;
                }
            }

            // If we found a name but no norm, try to grab any number left
            if (!rawNorm && numCells.length > 0) {
                const normCandidate = numCells.find(n => n !== materialSku && n.length < 10);
                if (normCandidate) rawNorm = normCandidate;
            }
        }

        // Extract Monthly Norms using currentIndices.monthIndices
        const monthlyNorms: Array<{ date: string; quantity: number }> = [];
        currentIndices.monthIndices.forEach(({ index, dateIso }) => {
            if (index < row.length && row[index] !== undefined) {
                const valStr = String(row[index]).replace(',', '.').replace(/\s/g, '');
                const parsed = parseFloat(valStr);
                if (!isNaN(parsed) && parsed > 0) { // Store only non-zero norms
                    monthlyNorms.push({ date: dateIso, quantity: Math.max(0, parsed) });
                }
            }
        });

        // Пропускаем совсем пустые
        if (!gpSku && !gpName && !materialSku && !materialName) {
            continue;
        }

        let currentTechCard: ImportedTechCard | null = null;

        if (gpSku) {
            // New Tech Card Found
            currentTechCard = {
                gpSku: gpSku,
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

        // Add ingredient to current tech card
        if (materialSku || materialName) {
            // Ignore if it looks like a header repetition (failsafe)
            if (materialSku.includes('Артикул') || materialName.includes('Назва')) continue;

            // Parse Base Norm
            let normVal = 0;
            const valStr = String(rawNorm).replace(',', '.').replace(/\s/g, '');
            const parsed = parseFloat(valStr);

            if (!isNaN(parsed)) {
                normVal = Math.max(0, parsed);
            }

            // START DEBUG for SKU 262178 (User Reported Issue)
            const debugTarget = '262178';
            if ((gpSku && gpSku.includes(debugTarget)) || (gpName && gpName.includes(debugTarget)) || (currentTechCard && currentTechCard.gpSku.includes(debugTarget))) {
                console.log(`[DEBUG ${debugTarget}] RAW ROW DUMP:`, JSON.stringify(row));
                console.log(`[DEBUG ${debugTarget}] Parsed as:`, { materialSku, materialName, normVal });
            }
            // END DEBUG

            currentTechCard.ingredients.push({
                materialCategory,
                materialSku,
                materialName,
                unit: parseUnit(unit),
                norm: normVal,
                monthlyNorms // Attach monthly norms
            });
        }
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


