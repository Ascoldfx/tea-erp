import * as XLSX from 'xlsx';
import type { Recipe } from '../types/production';
import type { InventoryItem, PlannedConsumption } from '../types/inventory';
import { supabase } from '../lib/supabase';

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
    recipe: Recipe,
    ingredient: { itemId: string; quantity: number },
    monthDate: string
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
                const norm = getNormForMonth(recipe, ingredient, month.date);
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

