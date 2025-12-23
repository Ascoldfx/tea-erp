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
    if (!unitStr) return 'pcs';

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

    return unitMap[unitStr.toLowerCase().trim()] || 'pcs';
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

    // Находим строку заголовков
    let headerRowIndex = 0;
    const headerKeywords = ['артикул гп', 'назва гп', 'название гп', 'артикул ксм', 'назва ксм', 'эталон'];

    for (let i = 0; i < Math.min(10, rawData.length); i++) {
        const row = rawData[i];
        if (!row) continue;

        const rowText = row.map(cell => String(cell || '').toLowerCase().trim()).join(' ');
        const hasHeader = headerKeywords.some(keyword => rowText.includes(keyword));

        if (hasHeader) {
            headerRowIndex = i;
            break;
        }
    }

    const headerRow = rawData[headerRowIndex] || [];
    const headers = headerRow.map((h: any) => String(h || '').trim());

    // Helper function to find column index by multiple possible names (case-insensitive, flexible)
    const findColumnIndex = (possibleNames: string[]): number => {
        for (const name of possibleNames) {
            const nameLower = name.toLowerCase().trim();
            for (let i = 0; i < headers.length; i++) {
                const header = String(headers[i] || '').trim();
                const headerLower = header.toLowerCase();

                // Exact match
                if (headerLower === nameLower) {
                    return i;
                }
                // Partial match (header contains the name or vice versa)
                if (headerLower.includes(nameLower) || nameLower.includes(headerLower)) {
                    return i;
                }
                // Regex match for patterns like "артикул гп" with spaces
                const regex = new RegExp(nameLower.replace(/\s+/g, '\\s*'), 'i');
                if (regex.test(headerLower)) {
                    return i;
                }
            }
        }
        return -1;
    };

    // Находим индексы нужных колонок с гибким поиском
    const gpSkuIndex = findColumnIndex([
        'Артикул ГП', 'Артикул Г.П.', 'Артикул ГП', 'Артикул ГП', 'SKU ГП', 'SKU Г.П.',
        'Артикул готовой продукции', 'Артикул ГП', 'Артикул ГП', 'Артикул ГП',
        'артикул гп', 'артикул г.п.', 'sku гп', 'артикул готовой продукции'
    ]);
    const gpNameIndex = findColumnIndex([
        'Назва ГП', 'Название ГП', 'Наименование ГП', 'Name ГП', 'Назва Г.П.',
        'Название готовой продукции', 'Назва готовой продукции', 'Наименование готовой продукции',
        'назва гп', 'название гп', 'наименование гп', 'name гп'
    ]);
    const materialCategoryIndex = findColumnIndex([
        'Група КСМ', 'Группа КСМ', 'Категория КСМ', 'Група', 'Группа', 'Category',
        'група ксм', 'группа ксм', 'категория ксм', 'група', 'группа', 'category'
    ]);
    const materialSkuIndex = findColumnIndex([
        'Артикул КСМ', 'Артикул К.С.М.', 'Артикул КСМ', 'SKU КСМ', 'SKU К.С.М.',
        'Артикул материала', 'Артикул КСМ', 'Артикул КСМ',
        'артикул ксм', 'артикул к.с.м.', 'sku ксм', 'артикул материала'
    ]);
    const materialNameIndex = findColumnIndex([
        'Назва КСМ', 'Название КСМ', 'Наименование КСМ', 'Name КСМ', 'Назва К.С.М.',
        'Название материала', 'Назва материала', 'Наименование материала',
        'назва ксм', 'название ксм', 'наименование ксм', 'name ксм', 'название материала'
    ]);
    const unitIndex = findColumnIndex([
        'Од. вим.', 'Од. вим', 'Единица измерения', 'Единица', 'Unit', 'Од. вим.',
        'од. вим.', 'од. вим', 'единица измерения', 'единица', 'unit'
    ]);
    const normIndex = findColumnIndex([
        'Еталон', 'Эталон', 'Норма', 'Norm', 'Базовая норма', 'Базова норма',
        'эталон', 'эталон', 'норма', 'norm', 'базовая норма', 'базова норма'
    ]);

    // Формируем список отсутствующих колонок для более информативного сообщения об ошибке
    const missingColumns: string[] = [];
    if (gpSkuIndex === -1) missingColumns.push('Артикул ГП');
    if (gpNameIndex === -1) missingColumns.push('Назва ГП');
    if (materialSkuIndex === -1) missingColumns.push('Артикул КСМ');
    if (materialNameIndex === -1) missingColumns.push('Назва КСМ');
    if (normIndex === -1) missingColumns.push('Еталон');

    if (missingColumns.length > 0) {
        const foundHeaders = headers.filter(h => h && !h.startsWith('__EMPTY')).slice(0, 10).join(', ');
        throw new Error(
            `Не найдены обязательные колонки: ${missingColumns.join(', ')}\n\n` +
            `Найденные колонки: ${foundHeaders}${headers.length > 10 ? '...' : ''}\n\n` +
            `Убедитесь, что в файле есть колонки с названиями:\n` +
            `- Артикул ГП (или Артикул Г.П., SKU ГП)\n` +
            `- Назва ГП (или Название ГП, Наименование ГП)\n` +
            `- Артикул КСМ (или Артикул К.С.М., SKU КСМ)\n` +
            `- Назва КСМ (или Название КСМ, Наименование КСМ)\n` +
            `- Еталон (или Эталон, Норма, Базовая норма)`
        );
    }

    // Группируем строки по готовой продукции
    const techCardsMap = new Map<string, ImportedTechCard>();
    let lastTechCard: ImportedTechCard | null = null; // Отслеживаем последнюю техкарту для продолжения

    console.log(`[parseTechCardsFromExcel] Начинаем парсинг с строки ${headerRowIndex + 1}, всего строк: ${rawData.length}`);

    for (let i = headerRowIndex + 1; i < rawData.length; i++) {
        const row = rawData[i];
        if (!row) continue;

        const gpSku = String(row[gpSkuIndex] || '').trim();
        const gpName = String(row[gpNameIndex] || '').trim();
        const materialSku = String(row[materialSkuIndex] || '').trim();
        const materialName = String(row[materialNameIndex] || '').trim();
        const materialCategory = materialCategoryIndex >= 0 ? String(row[materialCategoryIndex] || '').trim() : '';
        const unit = unitIndex >= 0 ? String(row[unitIndex] || '').trim() : 'шт';
        const norm = parseFloat(String(row[normIndex] || '0').replace(',', '.')) || 0;

        // Парсим нормы по месяцам из колонок с датами (формат DD.MM.YYYY или DD.MM.YY)
        const monthlyNorms: Array<{ date: string; quantity: number }> = [];
        const datePattern = /(\d{2})\.(\d{2})\.(\d{4})/; // DD.MM.YYYY
        const datePatternShort = /(\d{2})\.(\d{2})\.(\d{2})/; // DD.MM.YY

        // ВАЖНО: Используем headers (нормализованные) для поиска колонок с датами
        const maxCols = Math.max(headerRow.length, headers.length);

        for (let colIdx = 0; colIdx < maxCols; colIdx++) {
            // Получаем заголовок
            let headerStr = '';
            if (colIdx < headers.length) {
                headerStr = headers[colIdx];
            } else if (colIdx < headerRow.length) {
                headerStr = String(headerRow[colIdx] || '');
            }

            // Проверяем на Excel Serial Date (число ~40000-50000)
            const rawHeader = headerRow[colIdx];
            if (typeof rawHeader === 'number' && rawHeader > 35000 && rawHeader < 60000) {
                try {
                    const date = XLSX.SSF.parse_date_code(rawHeader);
                    if (date) {
                        const d = String(date.d).padStart(2, '0');
                        const m = String(date.m).padStart(2, '0');
                        const y = date.y;
                        headerStr = `${d}.${m}.${y}`;
                    }
                } catch (e) {
                    // Ignore parsing errors
                }
            }

            // Проверяем паттерн даты DD.MM.YYYY или DD.MM.YY
            let day, month, year;
            const matchFull = headerStr.match(datePattern);
            const matchShort = headerStr.match(datePatternShort);

            if (matchFull) {
                [, day, month, year] = matchFull.map(Number);
            } else if (matchShort) {
                [, day, month, year] = matchShort.map(Number);
                year += 2000; // Assume 20xx for 2-digit years
            }

            if (day && month && year && day >= 1 && day <= 31 && month >= 1 && month <= 12) {
                // Нормализуем дату к первому числу месяца (YYYY-MM-01)
                const monthDate = `${year}-${String(month).padStart(2, '0')}-01`;

                // Получаем значение
                let rowValue = (row as any[])[colIdx];
                if (rowValue === undefined || rowValue === null) {
                    const emptyKey = `__EMPTY_${colIdx}`;
                    rowValue = (row as any)[emptyKey];
                }

                // Пробуем через XLSX utils если значение не найдено
                if (rowValue === undefined && ws) {
                    try {
                        const cellAddress = XLSX.utils.encode_cell({ r: i, c: colIdx });
                        const cell = ws[cellAddress];
                        if (cell && cell.v !== undefined) rowValue = cell.v;
                    } catch (e) { }
                }

                // Парсим значение
                let quantity = 0;
                if (rowValue !== null && rowValue !== undefined && rowValue !== '') {
                    let strValue = String(rowValue).replace(',', '.').replace(/\s/g, '').trim();
                    if (strValue !== '' && strValue !== '-') {
                        const parsed = parseFloat(strValue);
                        if (!isNaN(parsed)) quantity = parsed;
                    }
                }

                monthlyNorms.push({ date: monthDate, quantity });
            }
        }

        // Пропускаем только полностью пустые строки
        if (!gpSku && !gpName && !materialSku && !materialName) continue;

        // Определяем текущую техкарту
        let currentTechCard: ImportedTechCard | null = null;

        if (gpSku || gpName) {
            const key = gpSku ? `${gpSku}|${gpName || gpSku}` : `|${gpName}`;
            if (!techCardsMap.has(key)) {
                techCardsMap.set(key, {
                    gpSku: gpSku || '',
                    gpName: gpName || gpSku || 'Без названия',
                    ingredients: []
                });
            }
            currentTechCard = techCardsMap.get(key)!;
            lastTechCard = currentTechCard;
        } else if (lastTechCard) {
            currentTechCard = lastTechCard;
        } else {
            continue;
        }

        // Добавляем ингредиент
        if (currentTechCard && (materialSku || materialName)) {
            // Функция нормализации строки для сравнения (убираем все пробелы, приводим к нижнему регистру)
            const normalize = (str: string) => str.toLowerCase().replace(/\s+/g, '').replace(/[^a-zа-я0-9]/gi, '');

            const normMaterialSku = normalize(materialSku);
            const normMaterialName = normalize(materialName);

            // Ищем дубликат с строгим сравнением
            const existingIngredientIndex = currentTechCard.ingredients.findIndex(ing => {
                const ingSku = normalize(ing.materialSku);
                const ingName = normalize(ing.materialName);

                // Если есть SKU у обоих - сравниваем SKU
                if (ingSku && normMaterialSku) return ingSku === normMaterialSku;
                // Иначе сравниваем названия
                return ingName === normMaterialName;
            });

            if (existingIngredientIndex === -1) {
                // Новая запись
                const ingredient = {
                    materialSku: materialSku || '',
                    materialName: materialName || materialSku || 'Без названия',
                    materialCategory,
                    unit: parseUnit(unit),
                    norm: norm || 0,
                    monthlyNorms: monthlyNorms.length > 0 ? monthlyNorms : undefined
                };
                currentTechCard.ingredients.push(ingredient);
            } else {
                // Дубликат найден - объединяем данные
                // console.log(`[parseTechCardsFromExcel] Дубликат материала: ${materialSku || materialName}. Объединяем данные.`);
                const existing = currentTechCard.ingredients[existingIngredientIndex];

                // Если норма была 0, а теперь не 0 - обновляем
                if (existing.norm === 0 && norm > 0) {
                    existing.norm = norm;
                }

                // ВАЖНО: Объединяем monthlyNorms
                if (monthlyNorms.length > 0) {
                    if (!existing.monthlyNorms) {
                        existing.monthlyNorms = [];
                    }

                    monthlyNorms.forEach(newM => {
                        const existingM = existing.monthlyNorms!.find(em => em.date === newM.date);
                        if (existingM) {
                            // Если есть существующая норма - берем максимальное (или непустое) значение
                            if (existingM.quantity === 0 && newM.quantity > 0) {
                                existingM.quantity = newM.quantity;
                            }
                        } else {
                            existing.monthlyNorms!.push(newM);
                        }
                    });
                }
            }
        }
    }

    const result = Array.from(techCardsMap.values());

    // Постобработка: если норма (etalon) равна 0, пытаемся найти норму на текущий месяц
    // Это нужно для случаев, когда в excel указаны только нормы по месяцам
    const currentDate = new Date();
    const currentMonthStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-01`;

    result.forEach(tc => {
        tc.ingredients.forEach(ing => {
            if (ing.norm === 0 && ing.monthlyNorms && ing.monthlyNorms.length > 0) {
                // Ищем норму на текущий месяц
                const currentMonthNorm = ing.monthlyNorms.find(mn => mn.date === currentMonthStr);

                if (currentMonthNorm && currentMonthNorm.quantity > 0) {
                    console.log(`[parseTechCardsFromExcel] 🔄 Updating norm for "${ing.materialName}" from 0 to ${currentMonthNorm.quantity} (current month)`);
                    ing.norm = currentMonthNorm.quantity;
                } else {
                    // Если на текущий месяц нет, берем первую доступную ненулевую норму (как fallback)
                    const firstNonZero = ing.monthlyNorms.find(mn => mn.quantity > 0);
                    if (firstNonZero) {
                        console.log(`[parseTechCardsFromExcel] 🔄 Updating norm for "${ing.materialName}" from 0 to ${firstNonZero.quantity} (first available: ${firstNonZero.date})`);
                        ing.norm = firstNonZero.quantity;
                    }
                }
            }
        });
    });

    console.log(`[parseTechCardsFromExcel] Импортировано техкарт: ${result.length}`);
    result.forEach((tc, idx) => {
        console.log(`[parseTechCardsFromExcel] Техкарта ${idx + 1}: SKU=${tc.gpSku}, Name=${tc.gpName}, Ингредиентов=${tc.ingredients.length}`);
    });

    return result;
}

