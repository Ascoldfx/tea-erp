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
    // Expanded keywords to be more robust
    const headerKeywords = ['артикул гп', 'назва гп', 'название гп', 'артикул ксм', 'назва ксм', 'эталон', 'норма', 'ingredients', 'компонент'];

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

    // DEBUG: Dump raw headers
    console.log('[parseTechCardsFromExcel] Normalized Headers (Row ' + headerRowIndex + '):', JSON.stringify(headers));

    // Helper: Find index prioritizing exact match, then loose match
    const findColumnIndex = (possibleNames: string[]): number => {
        const normalizedNames = possibleNames.map(n => n.toLowerCase());

        // 1. Exact match (case insensitive)
        for (const name of normalizedNames) {
            const idx = headers.findIndex(h => h.toLowerCase() === name);
            if (idx !== -1) return idx;
        }
        // 2. Contains match
        for (const name of normalizedNames) {
            const idx = headers.findIndex(h => h.toLowerCase().includes(name));
            if (idx !== -1) return idx;
        }
        return -1;
    };

    // 2. Определяем индексы основных колонок
    const gpSkuIndex = findColumnIndex(['Артикул ГП', 'Артикул Г.П.', 'SKU ГП', 'Артикул готовой продукции', 'Код ГП', 'Item Code', 'Артикул', 'Артикул.']);
    const gpNameIndex = findColumnIndex(['Назва ГП', 'Название ГП', 'Наименование ГП', 'Name ГП', 'Название готовой продукции', 'Назва', 'Наименование', 'Item Name']);
    const materialCategoryIndex = findColumnIndex(['Група КСМ', 'Группа КСМ', 'Категория КСМ', 'Група', 'Группа', 'Category', 'Тип']);
    const materialSkuIndex = findColumnIndex(['Артикул КСМ', 'Артикул К.С.М.', 'SKU КСМ', 'Артикул материала', 'Код', 'Code', 'Артикул KCM', 'SKU KCM', 'Component Code']);
    const materialNameIndex = findColumnIndex(['Назва КСМ', 'Название КСМ', 'Наименование КСМ', 'Name КСМ', 'Название материала', 'Назва KCM', 'Name KCM', 'Component Name']);
    const unitIndex = findColumnIndex(['Од. вим.', 'Од.вим', 'Од вим', 'Единица измерения', 'Единица', 'Unit', 'ед. изм.', 'ед изм', 'UOM']);

    // Ищем колонку Нормы
    let normIndex = findColumnIndex([
        'Еталон', 'Эталон', 'Норма', 'Norm', 'Базовая норма', 'Базова норма',
        'Кількість', 'Количество', 'Кол-во', 'Q-ty', 'Sum', 'Сума',
        'Нормы', 'Норм', 'Norms', 'Quantity'
    ]);

    // EMERGENCY FALLBACK: Если колонка нормы не найдена по имени, берем ПОСЛЕДНЮЮ колонку заголовка
    if (normIndex === -1 && headers.length > 0) {
        // Ищем последний индекс, который не пустой
        // Но обычно headers.length соответствует длине строки заголовка, так что берем последнюю
        let lastIndex = headers.length - 1;
        // Если последний заголовок пустой (бывает при экспорте), отступаем назад
        while (lastIndex >= 0 && (!headers[lastIndex] || headers[lastIndex].startsWith('__EMPTY'))) {
            lastIndex--;
        }

        if (lastIndex >= 0) {
            normIndex = lastIndex;
            console.warn(`[parseTechCardsFromExcel] ⚠️ Norm column not found by name. Using LAST valid column (index ${lastIndex}): "${headers[lastIndex]}"`);
        }
    } else {
        console.log(`[parseTechCardsFromExcel] ✅ Norm column found at index ${normIndex}`);
    }

    // DEBUG: Log all detected column indices for user validation
    console.log('[parseTechCardsFromExcel] Column Indexation Results:', {
        'GP SKU': gpSkuIndex,
        'GP Name': gpNameIndex,
        'Material Category': materialCategoryIndex,
        'Material SKU': materialSkuIndex,
        'Material Name': materialNameIndex,
        'Unit': unitIndex,
        'Norm': normIndex
    });

    // 3. Предварительно находим колонки с датами (для месячных норм)
    // Это оптимизация: ищем паттерны дат ОДИН раз, а не для каждой строки
    const datePattern = /(\d{1,2})[\.\/\-\s](\d{1,2})[\.\/\-\s](\d{4})/; // DD.MM.YYYY
    const datePatternShort = /(\d{1,2})[\.\/\-\s](\d{1,2})[\.\/\-\s](\d{2})/; // DD.MM.YY
    const dateColumnIndices: { index: number; dateIso: string }[] = [];

    headers.forEach((header, idx) => {
        // Пропускаем основные колонки, чтобы не путать даты с "Артикул 2023"
        if ([gpSkuIndex, gpNameIndex, materialSkuIndex, materialNameIndex, normIndex].includes(idx)) return;

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

    // Валидация обязательных колонок (без фанатизма, главное материалы)
    const missingColumns: string[] = [];
    if (materialNameIndex === -1 && materialSkuIndex === -1) missingColumns.push('Название или Артикул Материала');

    if (missingColumns.length > 0) {
        throw new Error(`Не найдены ключевые столбцы: ${missingColumns.join(', ')}. Проверьте файл.`);
    }

    console.log('[Parser] Detected Columns:', { gpSkuIndex, gpNameIndex, materialSkuIndex, materialNameIndex, unitIndex });

    // 4. Парсим строки
    const techCardsMap = new Map<string, ImportedTechCard>();
    // Map<OriginalSKU, Array<{name: string, assignedSku: string}>>
    // const skuVariationsMap = new Map<string, Array<{ name: string, assignedSku: string }>>();

    let lastTechCard: ImportedTechCard | null = null;
    const result: ImportedTechCard[] = [];

    // Используем rawData напрямую
    for (let i = headerRowIndex + 1; i < rawData.length; i++) {
        const row = rawData[i];
        if (!row || row.length === 0) continue;

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

        const gpSku = getCell(gpSkuIndex);
        const gpName = getCell(gpNameIndex);
        const materialSku = getCell(materialSkuIndex);
        const materialName = getCell(materialNameIndex);

        // DEBUG: Verbose logging for problematic rows
        if (gpSku.includes('282085') || materialSku.includes('2010331') || i < 15) { // Log first few rows + problems
            console.log(`[Parser DEBUG] Row ${i}:`, {
                gpSku, gpName, materialSku, materialName,
                rawRow: JSON.stringify(row)
            });
        }

        // Пропускаем совсем пустые
        if (!gpSku && !gpName && !materialSku && !materialName) {
            console.log(`[Parser] Skipping completely empty row ${i}`);
            continue;
        }

        // DEBUG: Логируем обработку строки для проблемных артикулов (или всех для дебага)
        if (gpSku.includes('282085') || gpSku.includes('282090')) {
            console.log(`[Parser] Row ${i}: GP=${gpSku} '${gpName}', Mat=${materialSku} '${materialName}' (HasGP=${Boolean(gpSku || gpName)}, HasMat=${Boolean(materialSku || materialName)})`);
        }

        // Определяем ТехКарту (Parent)
        let currentTechCard: ImportedTechCard;
        const hasGpInfo = gpSku || gpName;

        if (hasGpInfo) {
            let finalSku = gpSku || '';
            // const normalizedName = gpName.toLowerCase().trim();

            /* 
               OLD LOGIC: Split by name variations (Solo vs Non-Solo)
               This caused fragmentation because header rows had "Solo" but ingredient rows didn't.
               
               NEW LOGIC: Unified by SKU.
               If SKU is present, all rows with this SKU belong to the SAME card.
               The first Name encountered becomes the card name.
            */

            // Простая логика: ключ - это SKU (если есть) или Название
            // Это объединяет "Solo" и "Не-Solo" в одну карту, если у них одинаковый артикул.
            const key = finalSku ? finalSku : gpName;

            if (!techCardsMap.has(key)) {
                currentTechCard = {
                    gpSku: finalSku, // Use the unique SKU
                    gpName: gpName || gpSku || 'Без названия',
                    ingredients: []
                };
                techCardsMap.set(key, currentTechCard);
                // Сохраняем порядок
                result.push(currentTechCard);
            } else {
                currentTechCard = techCardsMap.get(key)!;
            }
            lastTechCard = currentTechCard;
        } else if (lastTechCard) {
            // Если нет заголовка ГП, привязываем к предыдущей (строка ингредиента)
            currentTechCard = lastTechCard;
        } else {
            // Сирота (ингредиент без ГП и не было предыдущей ГП) - пропускаем
            continue;
        }

        // Если это строка с материалом
        if (materialSku || materialName) {
            const unit = getCell(unitIndex) || 'kg'; // Default to kg

            // Парсинг Базовой Нормы
            let normVal = 0;
            if (normIndex >= 0 && row[normIndex] !== undefined) {
                const valStr = String(row[normIndex]).replace(',', '.').replace(/\s/g, '');
                const parsed = parseFloat(valStr);
                if (!isNaN(parsed)) normVal = Math.max(0, parsed);
            }

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
                    normRaw: row[normIndex],
                    normParsed: normVal,
                    monthlyCount: monthlyNorms.length
                });
            }

            // START DEBUG for SKU 282057
            if ((gpSku && gpSku.includes('282057')) || (gpName && gpName.includes('282057')) || (lastTechCard && lastTechCard.gpSku.includes('282057'))) {
                console.log(`[DEBUG 282057] Row ${i}:`, {
                    gpSku,
                    gpName: gpName?.substring(0, 20),
                    hasGpInfo,
                    materialSku,
                    materialName: materialName?.substring(0, 20),
                    normIndex,
                    normRawThisRow: row[normIndex],
                    currentCardSku: currentTechCard?.gpSku,
                    currentCardIngs: currentTechCard?.ingredients.length
                });
            }
            // END DEBUG

            // Добавляем ингредиент
            const ingredient = {
                materialSku,
                materialName: materialName || materialSku || 'Ингредиент',
                materialCategory: getCell(materialCategoryIndex),
                unit: parseUnit(unit),
                norm: normVal,
                monthlyNorms: monthlyNorms.length > 0 ? monthlyNorms : undefined
            };

            // Проверка на дубликаты ВНУТРИ этой техкарты (бывает, что один материал разбит на 2 строки)
            // Упрощенная логика: если SKU+Name совпадают - складываем нормы
            const existingIng = currentTechCard.ingredients.find(ing =>
                (ing.materialSku && ing.materialSku === ingredient.materialSku) ||
                (ing.materialName === ingredient.materialName) // Fallback to name match
            );

            if (existingIng) {
                if (existingIng.norm === 0 && ingredient.norm > 0) existingIng.norm = ingredient.norm;
                // Merge monthly norms if needed (too complex for now, assume rows are distinct or simple additive? Let's just keep first one for safety or overwrite?
                // Let's keep existing logic simplistic: merge array
                if (ingredient.monthlyNorms) {
                    if (!existingIng.monthlyNorms) existingIng.monthlyNorms = [];
                    existingIng.monthlyNorms.push(...ingredient.monthlyNorms);
                }
            } else {
                currentTechCard.ingredients.push(ingredient);
            }
        }
    }

    console.log(`[parseTechCardsFromExcel] Parsed ${result.length} tech cards.`);
    return result;
}

