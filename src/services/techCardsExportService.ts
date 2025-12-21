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
        norm: number;
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

        // Пропускаем пустые строки
        if (!gpSku || !gpName || !materialSku || !materialName || norm === 0) {
            continue;
        }

        const key = `${gpSku}|${gpName}`;

        if (!techCardsMap.has(key)) {
            techCardsMap.set(key, {
                gpSku,
                gpName,
                ingredients: []
            });
        }

        const techCard = techCardsMap.get(key)!;
        techCard.ingredients.push({
            materialSku,
            materialName,
            materialCategory,
            unit: parseUnit(unit),
            norm
        });
    }

    return Array.from(techCardsMap.values());
}

