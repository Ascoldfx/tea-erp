import { useState, useEffect } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Upload, FileSpreadsheet, Check, AlertTriangle, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { inventoryService } from '../../services/inventoryService';
import { useInventory } from '../../hooks/useInventory';
import { useLanguage } from '../../context/LanguageContext';

interface ExcelImportModalProps {
    isOpen: boolean;
    onClose: () => void;
}

interface ParsedItem {
    code: string;
    name: string;
    unit: string;
    category: string;
    stockMain: number; // Общий остаток (база/1С) - для картонной упаковки это общий остаток
    stockWarehouses: Record<string, number>; // Остатки на складах подрядчиков: { 'wh-ts': 100, 'wh-fito': 50, ... }
    storageLocation?: string; // Место хранения из Excel
    baseNorm?: number; // Базовая норма (эталон)
    plannedConsumption: Array<{
        date: string; // YYYY-MM-DD (первый день месяца)
        quantity: number;
        isActual?: boolean; // true для фактического расхода (прошедшие месяцы), false для планового (будущие месяцы)
    }>;
}

interface ParsedSupplier {
    name: string;
}

export default function ExcelImportModal({ isOpen, onClose }: ExcelImportModalProps) {
    const { t, language } = useLanguage();
    const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'success'>('upload');
    const [parsedData, setParsedData] = useState<ParsedItem[]>([]);
    const [parsedSuppliers, setParsedSuppliers] = useState<ParsedSupplier[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [sheetNames, setSheetNames] = useState<string[]>([]);
    const [selectedSheet, setSelectedSheet] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const { refresh } = useInventory();

    // Reset state when modal opens
    useEffect(() => {
        if (isOpen) {
            setStep('upload');
            setParsedData([]);
            setParsedSuppliers([]);
            setError(null);
            setSheetNames([]);
            setSelectedSheet('');
            setLoading(false);
            // Reset file input
            const fileInput = document.getElementById('file-upload') as HTMLInputElement;
            if (fileInput) {
                fileInput.value = '';
            }
        }
    }, [isOpen]);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setLoading(true);
        setError(null);

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const bstr = evt.target?.result;

                // Read workbook with options to handle formulas and large files
                const wb = XLSX.read(bstr, {
                    type: 'binary',
                    cellDates: true,
                    cellNF: false,
                    cellText: true, // Get calculated values instead of formulas
                    sheetStubs: false,
                    dense: false // Use sparse mode for large files
                });

                // Get all sheet names
                const sheets = wb.SheetNames;
                setSheetNames(sheets);

                // If only one sheet, auto-select it
                if (sheets.length === 1) {
                    setSelectedSheet(sheets[0]);
                    parseSheet(wb, sheets[0]);
                } else {
                    // Show sheet selector
                    setSelectedSheet('');
                    setStep('upload'); // Stay on upload to show sheet selector
                }
            } catch (err) {
                console.error(err);
                setError('Ошибка чтения файла. Убедитесь, что это валидный Excel файл.');
                setLoading(false);
            }
        };
        reader.readAsBinaryString(file);
    };

    const parseSheet = (wb: XLSX.WorkBook, sheetName: string) => {
        try {
            const ws = wb.Sheets[sheetName];
            if (!ws) {
                setError(`Вкладка "${sheetName}" не найдена`);
                setLoading(false);
                return;
            }

            // First, try to find header row by reading as array of arrays
            const rawData = XLSX.utils.sheet_to_json(ws, {
                defval: '',
                raw: false,
                header: 1 // Get as array of arrays
            }) as any[][];

            if (!rawData || rawData.length === 0) {
                setError('Файл пуст или не содержит данных. Проверьте, что выбрана правильная вкладка.');
                setLoading(false);
                return;
            }

            // Find header row - look for row containing key words like "Артикул", "Назва", "Код", etc.
            let headerRowIndex = 0;
            const headerKeywords = ['артикул', 'назва', 'название', 'наименование', 'код', 'code', 'sku', 'name'];

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

            // Extract headers from found row
            const headerRow = rawData[headerRowIndex] || [];
            const headers = headerRow.map((h: any) => String(h || '').trim());

            // Check row ABOVE headers for month names (common Excel structure: month row, then "план витрат" row)
            const monthRowIndex = headerRowIndex > 0 ? headerRowIndex - 1 : -1;
            const monthRow = monthRowIndex >= 0 ? rawData[monthRowIndex] || [] : [];

            // Helper function to parse month name to date string
            const parseMonthToDate = (monthName: string, year?: number): string | null => {
                const monthLower = String(monthName || '').toLowerCase().trim();
                const monthMap: Record<string, number> = {
                    'январь': 1, 'января': 1, 'січень': 1, 'січня': 1,
                    'февраль': 2, 'февраля': 2, 'лютий': 2, 'лютого': 2,
                    'март': 3, 'марта': 3, 'березень': 3, 'березня': 3,
                    'апрель': 4, 'апреля': 4, 'квітень': 4, 'квітня': 4,
                    'май': 5, 'мая': 5, 'травень': 5, 'травня': 5,
                    'июнь': 6, 'июня': 6, 'червень': 6, 'червня': 6,
                    'июль': 7, 'июля': 7, 'липень': 7, 'липня': 7,
                    'август': 8, 'августа': 8, 'серпень': 8, 'серпня': 8,
                    'сентябрь': 9, 'сентября': 9, 'вересень': 9, 'вересня': 9,
                    'октябрь': 10, 'октября': 10, 'жовтень': 10, 'жовтня': 10,
                    'ноябрь': 11, 'ноября': 11, 'листопад': 11, 'листопада': 11,
                    'декабрь': 12, 'декабря': 12, 'грудень': 12, 'грудня': 12
                };

                if (monthMap[monthLower]) {
                    const month = monthMap[monthLower];
                    const finalYear = year || new Date().getFullYear();
                    return `${finalYear}-${String(month).padStart(2, '0')}-01`;
                }
                return null;
            };

            // Map column indices to month dates (if month is found in row above headers)
            // Месяц указывается СТРОГО над столбцом (в той же колонке)
            // Это работает для:
            // 1. "план витрат" - план расходов на месяц
            // 2. "залишки на 1 число" - остатки на 1 число месяца
            const columnToMonthMap = new Map<number, string>();
            for (let colIndex = 0; colIndex < Math.max(headers.length, monthRow.length); colIndex++) {
                const monthCell = monthRow[colIndex] ? String(monthRow[colIndex]).trim() : '';
                const headerCell = headers[colIndex] ? String(headers[colIndex]).trim() : '';
                const headerLower = headerCell.toLowerCase();

                // Check if this column has "план витрат" or "залишки на 1 число" in header
                const isPlannedConsumption = headerLower.includes('план') && (headerLower.includes('витрат') || headerLower.includes('расход'));
                const isStockColumn = (headerLower.includes('залишки') || headerLower.includes('зал')) &&
                    (headerLower.includes('1') || headerLower.includes('число'));

                if (isPlannedConsumption || isStockColumn) {
                    // Check if month is in the cell above (STRICTLY same column, not adjacent)
                    if (monthCell) {
                        const monthDate = parseMonthToDate(monthCell);
                        if (monthDate) {
                            columnToMonthMap.set(colIndex, monthDate);
                            const columnType = isPlannedConsumption ? 'план витрат' : 'залишки на 1 число';
                            console.log(`[Excel Import] Found month "${monthCell}" STRICTLY above "${columnType}" column ${colIndex}, mapped to date: ${monthDate}`);
                        }
                    }
                }
            }

            // Skip header row and empty rows, convert to objects
            const dataRows = rawData.slice(headerRowIndex + 1).filter(row => {
                // Skip completely empty rows
                return row && row.some(cell => String(cell || '').trim() !== '');
            });

            // Convert to array of objects using found headers
            const data = dataRows.map(row => {
                const obj: any = {};
                headers.forEach((header, index) => {
                    const key = header || `__EMPTY_${index}`;
                    obj[key] = row[index] || '';
                });
                return obj;
            });

            if (data.length === 0) {
                setError('Не найдено строк с данными. Проверьте формат файла.');
                setLoading(false);
                return;
            }

            // Get all column names (for error messages)
            const columnNames = headers.filter(h => h && !h.startsWith('__EMPTY'));

            // Helper function to find column by multiple possible names (case-insensitive, trim)
            const findColumn = (row: any, possibleNames: string[]): string => {
                for (const name of possibleNames) {
                    // Try exact match first
                    if (row[name] !== undefined && row[name] !== null && row[name] !== '') {
                        return String(row[name]).trim();
                    }
                    // Try case-insensitive match
                    for (const key in row) {
                        const keyLower = key.trim().toLowerCase();
                        const nameLower = name.toLowerCase().trim();
                        // Exact match
                        if (keyLower === nameLower) {
                            const value = row[key];
                            if (value !== undefined && value !== null && value !== '') {
                                return String(value).trim();
                            }
                        }
                        // Partial match (header contains the name)
                        if (keyLower.includes(nameLower) || nameLower.includes(keyLower)) {
                            const value = row[key];
                            if (value !== undefined && value !== null && value !== '') {
                                return String(value).trim();
                            }
                        }
                    }
                }
                return '';
            };

            // Find date columns (e.g., "01.12.2023", "01.12.2025")
            const datePattern = /\d{2}\.\d{2}\.\d{4}/;
            const dateColumnIndices: number[] = [];

            // Month names mapping (Russian and Ukrainian)
            const monthNames: Record<string, number> = {
                'январь': 1, 'января': 1, 'січень': 1, 'січня': 1,
                'февраль': 2, 'февраля': 2, 'лютий': 2, 'лютого': 2,
                'март': 3, 'марта': 3, 'березень': 3, 'березня': 3,
                'апрель': 4, 'апреля': 4, 'квітень': 4, 'квітня': 4,
                'май': 5, 'мая': 5, 'травень': 5, 'травня': 5,
                'июнь': 6, 'июня': 6, 'червень': 6, 'червня': 6,
                'июль': 7, 'июля': 7, 'липень': 7, 'липня': 7,
                'август': 8, 'августа': 8, 'серпень': 8, 'серпня': 8,
                'сентябрь': 9, 'сентября': 9, 'вересень': 9, 'вересня': 9,
                'октябрь': 10, 'октября': 10, 'жовтень': 10, 'жовтня': 10,
                'ноябрь': 11, 'ноября': 11, 'листопад': 11, 'листопада': 11,
                'декабрь': 12, 'декабря': 12, 'грудень': 12, 'грудня': 12
            };

            // Find month name columns and date columns
            const monthColumnIndices: Array<{ index: number; month: number; year?: number }> = [];
            headers.forEach((header, index) => {
                const headerLower = String(header || '').toLowerCase().trim();

                // Check for date pattern (DD.MM.YYYY)
                if (datePattern.test(String(header || ''))) {
                    dateColumnIndices.push(index);
                }

                // Check for month name
                if (monthNames[headerLower]) {
                    const month = monthNames[headerLower];
                    // Try to extract year from header or use current year
                    const yearMatch = String(header || '').match(/(\d{4})/);
                    const year = yearMatch ? parseInt(yearMatch[1]) : new Date().getFullYear();
                    monthColumnIndices.push({ index, month, year });
                }
            });

            // Track last category for empty group cells
            let lastCategory = 'other';

            // Flexible column mapping (supports both English and Russian headers, case-insensitive)
            const items: ParsedItem[] = data.map((row: any) => {
                // Try multiple column name variations (case-insensitive)
                // Supports Russian, Ukrainian, and English column names
                const code = findColumn(row, [
                    'Code', 'Код', 'SKU', 'Артикул', 'Арт.', 'Арт', 'Код товара',
                    'КодТовара', 'Код_товара', 'Артикул товара', 'АртикулТовара',
                    'Артикул товара', 'АртикулТовара'
                ]);

                const nameRaw = findColumn(row, [
                    'Name', 'Наименование', 'Название', 'Товар', 'Назва', 'Наименование товара',
                    'НаименованиеТовара', 'Название товара', 'НазваниеТовара', 'Товар', 'Продукт',
                    'Назва', 'Назва товара', 'НазваТовара' // Ukrainian
                ]);
                const name = nameRaw ? String(nameRaw).trim() : '';

                // Skip items where name is just "0" or empty
                if (!name || name === '' || name === '0' || name.trim() === '0') {
                    return null; // Will be filtered out
                }

                const unitRaw = findColumn(row, [
                    'Unit', 'Ед. изм.', 'Единица', 'Ед', 'Ед.изм', 'Единица измерения',
                    'ЕдиницаИзмерения', 'Ед. измерения', 'ЕдИзмерения',
                    'Од. вим.', 'Одиниця', 'Од', 'Од. виміру' // Ukrainian
                ]);
                // Normalize unit: convert pcs to шт
                let unit = unitRaw || 'шт';
                if (unit.toLowerCase() === 'pcs' || unit.toLowerCase() === 'шт') {
                    unit = 'шт';
                }

                // Get category from "Група" column, map common values
                // If empty, use last category (inherit from previous row)
                const groupValueRaw = findColumn(row, [
                    'Category', 'Категория', 'Группа', 'Категорія', 'Група',
                    'Категория товара', 'КатегорияТовара', 'Группа товара',
                    'Категорія товара', 'КатегоріяТовара' // Ukrainian
                ]);
                let groupValue = groupValueRaw ? String(groupValueRaw).toLowerCase().trim() : '';

                // If group is empty, use last category
                if (!groupValue || groupValue === '') {
                    groupValue = lastCategory;
                } else {
                    // Update last category for next rows
                    lastCategory = groupValue;
                }

                // Map group values to categories
                // STRICT LOGIC: Each material can belong to ONLY ONE category
                // Priority order matters - check most specific first
                // IMPORTANT: If groupValue is empty, always use 'other'
                let category = 'other'; // default to 'other'

                // If no group value provided, always use 'other'
                if (!groupValue || groupValue === '') {
                    category = 'other';
                }
                // 1. Ароматизаторы - если указано в группе (более гибкая проверка)
                else if (groupValue === 'flavor' ||
                    groupValue === 'ароматизатор' || groupValue === 'ароматизаторы' ||
                    groupValue === 'ароматизатори' || groupValue === 'ароматизаторів' ||
                    groupValue.startsWith('ароматизатор') ||
                    groupValue.includes('ароматизатор') ||
                    groupValue.includes('flavor')) {
                    category = 'flavor';
                }
                // 2. Ярлыки - более гибкая проверка (было строго)
                else if (groupValue === 'label' ||
                    groupValue.includes('ярлик') ||
                    groupValue.includes('ярлики') ||
                    groupValue.includes('ярлык') ||
                    groupValue.includes('ярлыки') ||
                    groupValue.includes('label')) {
                    category = 'label';
                }
                // 3. Стикеры/этикетки/наклейки - ТОЛЬКО если явно указано в группе (строгая проверка)
                else if (groupValue === 'sticker' || groupValue === 'стикер' || groupValue === 'стикеры' || groupValue === 'стикери' ||
                    groupValue === 'этикетка' || groupValue === 'этикетки' || groupValue === 'етикетка' || groupValue === 'етикетки' ||
                    groupValue === 'наклейка' || groupValue === 'наклейки' || groupValue === 'наклейка' || groupValue === 'наклейки' ||
                    groupValue.startsWith('стикер') || groupValue.startsWith('этикетк') || groupValue.startsWith('етикетк') ||
                    groupValue.startsWith('наклейк') || groupValue.startsWith('наклейк') ||
                    groupValue.includes(' стикер') || groupValue.includes(' этикетк') || groupValue.includes(' етикетк') ||
                    groupValue.includes(' наклейк') || groupValue.includes(' наклейк')) {
                    category = 'sticker';
                }
                // 4. Картонная упаковка - отдельная категория (проверяем ПЕРЕД конвертами и общей упаковкой)
                // Приоритет картона выше, чтобы позиции с группой "картон" не попадали в другие категории
                if (groupValue === 'картон' || groupValue.includes('картон') || groupValue.includes('картонн') ||
                    groupValue === 'packaging_cardboard' || groupValue.trim().toLowerCase() === 'картон') {
                    category = 'packaging_cardboard';
                }
                // 5. Конверты - отдельная категория (проверяем ПОСЛЕ картона)
                else if (groupValue === 'envelope' || groupValue === 'конверт' || groupValue === 'конверты' || groupValue === 'конверти' ||
                    groupValue.startsWith('конверт') || groupValue.includes(' конверт')) {
                    // Убрали проверку по названию nameLower.includes('конверт'), чтобы картон не попадал в конверты
                    category = 'envelope';
                }
                // 5a. Коробки и пачки - теперь это картонная упаковка
                else if (groupValue === 'packaging_box' || groupValue === 'коробка' || groupValue === 'коробки' ||
                    (groupValue.includes('коробк') && !groupValue.includes('гофро'))) {
                    category = 'packaging_cardboard';
                }
                // 6. Гофроящики - отдельная категория (проверяем ПЕРЕД общей упаковкой)
                else if (groupValue.includes('г/я') || groupValue.includes('гофро') || groupValue.includes('гофроящик') ||
                    (groupValue.includes('ящик') && groupValue.includes('гофро'))) {
                    category = 'packaging_crate';
                }
                // 7. Мягкая упаковка (м/у) - отдельная категория
                else if (groupValue === 'soft_packaging' || groupValue === 'м/у' || groupValue === 'м\'яка упаковка' ||
                    groupValue.includes('мягкая упаковка') || groupValue.includes('м\'яка упаковка') ||
                    (groupValue.includes('упаковк') && (groupValue.includes('мягк') || groupValue.includes('м\'як')))) {
                    category = 'soft_packaging';
                }
                // 8. Пачки - теперь это картонная упаковка (проверяем ПЕРЕД общей упаковкой)
                else if (groupValue === 'пачка' || groupValue === 'пачки' || groupValue.startsWith('пачка') ||
                    (groupValue.includes('пачка') && !groupValue.includes('упаковк'))) {
                    category = 'packaging_cardboard';
                }
                // 9. Упаковка (общая) - только если НЕ картон, НЕ гофро, НЕ мягкая (пленка, пакет, бумага, нитки)
                else if ((groupValue.includes('упаковк') || groupValue.includes('пленк') || groupValue.includes('пакет') ||
                    groupValue.includes('папір') || groupValue.includes('нитки') || groupValue === 'packaging_consumable') &&
                    !groupValue.includes('картон') && !groupValue.includes('гофро') &&
                    !groupValue.includes('мягк') && !groupValue.includes('м\'як')) {
                    category = 'packaging_consumable';
                }
                // 10. Сырье, цедра, травы, чай
                else if (groupValue === 'tea_bulk' || groupValue.includes('сировин') || groupValue.includes('цедра') ||
                    groupValue.includes('трав') || groupValue.includes('чай') ||
                    (groupValue.includes('чай') && !groupValue.includes('упаковк'))) {
                    category = 'tea_bulk';
                }

                // FALLBACK: Check Name for specific keywords if category is still 'other' (or to override generic groups)
                const nameLower = name.toLowerCase();

                if (category === 'other') {
                    if (nameLower.includes('ярлык') || nameLower.includes('ярлик') || nameLower.includes('label')) {
                        category = 'label';
                    } else if (nameLower.includes('стикер') || nameLower.includes('наклейк') || nameLower.includes('етикетк')) {
                        category = 'sticker';
                    } else if (nameLower.includes('ароматизатор') || nameLower.includes('flavor')) {
                        category = 'flavor';
                    } else if (nameLower.includes('конверт') || nameLower.includes('envelope')) {
                        category = 'envelope';
                    }
                }

                // 11. Если значение существует, но не совпадает с известными категориями
                const KNOWN_CATEGORIES = [
                    'tea_bulk', 'flavor', 'packaging_consumable', 'packaging_crate',
                    'label', 'sticker', 'soft_packaging', 'envelope', 'packaging_cardboard'
                ];

                if (category === 'other' && groupValue && groupValue !== '') {
                    const validCategories: string[] = [...KNOWN_CATEGORIES, 'other'];
                    if (validCategories.includes(groupValue)) {
                        category = groupValue as any;
                    } else {
                        // If unknown category, normalize and use it as dynamic category
                        const normalizedGroup = groupValue
                            .toLowerCase()
                            .trim()
                            .replace(/\s+/g, '_')
                            .replace(/[^a-z0-9_а-яёіїє]/g, '')
                            .substring(0, 50);

                        if (normalizedGroup && normalizedGroup.length > 0) {
                            category = normalizedGroup;
                            console.log(`[Category Debug] Using dynamic category: "${normalizedGroup}" from groupValue: "${groupValue}"`);
                        } else {
                            category = 'other';
                        }
                    }
                }

                // Find stock columns
                // Формат: "залишки на [дата] [склад]"
                // Примеры: "залишки на 30.11 база", "залишки на 30.11 ТС", "залишки на 31.10 Кава"
                let stockMain = 0; // Общий остаток (база/1С)
                const stockWarehouses: Record<string, number> = {}; // Остатки на складах подрядчиков

                // Маппинг названий складов на их ID
                const warehouseNameMap: Record<string, string> = {
                    'база': 'wh-kotsyubinske',
                    'базы': 'wh-kotsyubinske',
                    '1с': 'wh-kotsyubinske',
                    '1 с': 'wh-kotsyubinske',
                    'коцюбинське': 'wh-kotsyubinske',
                    'коцюбинское': 'wh-kotsyubinske',
                    'тс': 'wh-ts',
                    'ts': 'wh-ts',
                    'май': 'wh-ts', // Старое название
                    'кава': 'wh-kava',
                    'kava': 'wh-kava',
                    'бакалея': 'wh-bakaleya',
                    'bakaleya': 'wh-bakaleya',
                    'фіто': 'wh-fito',
                    'фито': 'wh-fito',
                    'fito': 'wh-fito',
                    'фото': 'wh-fito', // Опечатка
                    'тс трейд': 'wh-ts-treyd',
                    'тс трейт': 'wh-ts-treyd',
                    'ts treyd': 'wh-ts-treyd',
                    'ts treyt': 'wh-ts-treyd'
                };

                // Find storage location column
                const storageLocation = findColumn(row, [
                    'Место хранения', 'Место хранения', 'Местонахождение', 'Локация', 'Location',
                    'Місце зберігання', 'Місцезнаходження', 'Локація'
                ]);

                // Look for stock columns - iterate through headers directly
                // Формат: "залишки на [дата] [склад]"

                // Track the latest date score for each warehouse to handle fallback logic
                const warehouseStockDates: Record<string, { dateScore: number, val: number }> = {};

                for (let i = 0; i < headers.length; i++) {
                    const header = String(headers[i] || '').trim();
                    const headerLower = header.toLowerCase();
                    // Helper to parse flexible numbers (spaces, commas, dots)
                    // Now context-aware: checks category to make smarter decisions
                    const parseStockValue = (val: any): number | null => {
                        if (val === undefined || val === null || val === '') return null;
                        let str = String(val).trim();
                        if (str === '-') return 0; // Sometimes '-' means 0

                        // Remove spaces (thousand separators)
                        str = str.replace(/\s/g, '');

                        // Special handling for labels/stickers (always integer pieces).
                        // In RU/UA locale, dots are often thousand separators (e.g. 1.551 or 2.124.770).
                        const isIntegerItem = category === 'label' ||
                            category === 'sticker' ||
                            nameLower.includes('ярлик') ||
                            nameLower.includes('стикер');

                        if (isIntegerItem) {
                            // DEBUG LOGGING for Labels
                            // console.log(`[Import Debug] Label Item: "${name}", Raw: "${val}", Cleaned: "${str}"`);

                            // For labels: remove ALL dots (treat as thousand separators).
                            // Treat comma as decimal (unlikely for labels but let's keep it standard).
                            const originalStr = str;
                            str = str.replace(/\./g, '').replace(',', '.');

                            // console.log(`[Import Debug] Label Logic: "${originalStr}" -> "${str}"`);
                        } else {
                            // General logic
                            const dotCount = (str.match(/\./g) || []).length;
                            const hasComma = str.includes(',');

                            if (hasComma) {
                                // Comma is decimal separator -> remove dots, replace comma
                                str = str.replace(/\./g, '').replace(',', '.');
                            } else if (dotCount > 1) {
                                // Multiple dots -> thousand separators
                                str = str.replace(/\./g, '');
                            } else {
                                // Single dot -> ambiguous context, treat as decimal for non-labels
                                // "1.500" -> 1.5
                            }
                        }

                        const num = parseFloat(str);
                        return isNaN(num) ? null : num;
                    };

                    const rawValue = row[header] || row[`__EMPTY_${i}`];
                    const stockVal = parseStockValue(rawValue);

                    // Debug log for every header to see what we are processing
                    // console.log(`[Import Debug] Processing header [${i}]: "${header}". Raw: "${rawValue}", Parsed: ${stockVal}`);

                    // Skip if this is a planned consumption column
                    if (headerLower.includes('план') && (headerLower.includes('витрат') || headerLower.includes('расход'))) {
                        // console.log(`[Import Debug] Skipping planned consumption: "${header}"`);
                        continue;
                    }

                    // Skip if not a stock column
                    // Relaxed check: allow 'залишки', 'зал', 'остаток', or just 'на [date]' pattern if needed, but let's stick to keywords first
                    if (!headerLower.includes('залишки') && !headerLower.includes('зал') && !headerLower.includes('остаток')) {
                        // console.log(`[Import Debug] Not a stock keyword: "${header}"`);
                        continue;
                    }

                    // Парсим формат "залишки [на] [дата] [склад]"
                    // Примеры: "залишки на 30.11 база", "залишки 30.11 ТС", "залишки 31.10 Кава"
                    // Regex explanation:
                    // залишки: keyword
                    // (?:\s+на)?: optional "на" word
                    // \s*: optional spaces
                    // (\d{1,2})[\./-](\d{1,2}): date day.month (dot, slash or dash)
                    // \s*: optional spaces
                    // (.+): warehouse name
                    const stockMatch = headerLower.match(/залишки(?:.*на)?\s*(\d{1,2})[\./-](\d{1,2})\s*(.+)/);

                    if (stockMatch) {
                        const day = parseInt(stockMatch[1]);
                        const month = parseInt(stockMatch[2]);
                        const warehouseName = stockMatch[3].trim();

                        // Construct a comparable date value (Month * 100 + Day) just for comparison
                        // Assuming same year mostly, or we don't care about year wrapping for short term
                        // Better: 2024 (default) ... let's use a simple score: Month * 32 + Day
                        const dateScore = month * 32 + day;

                        console.log(`[Import Debug] Matched stock column: "${header}" -> D:${day}/M:${month}, Warehouse: "${warehouseName}". RawValue: "${rawValue}"`);

                        // Определяем склад по названию
                        let warehouseId: string | null = null;
                        for (const [name, id] of Object.entries(warehouseNameMap)) {
                            if (warehouseName.includes(name)) {
                                warehouseId = id;
                                break;
                            }
                        }

                        // Специальная логика для ТС Трейд: был только до 28.05, потом стал просто ТС
                        if (warehouseName.includes('тс трейд') || warehouseName.includes('ts treyd')) {
                            if (month === 5 && day <= 28) {
                                warehouseId = 'wh-ts-treyd';
                            } else {
                                warehouseId = 'wh-ts';
                            }
                        }

                        if (warehouseId) {
                            // Only update if:
                            // 1. We have a valid parsed value (stockVal !== null)
                            // 2. AND (We haven't recorded this warehouse yet OR This column is for a newer date)

                            const existing = warehouseStockDates[warehouseId];

                            if (stockVal !== null) {
                                if (!existing || dateScore >= existing.dateScore) {
                                    // Special case: if dateScore is SAME, we overwrite (later column > earlier column)

                                    // Update the main stock vars
                                    if (warehouseId === 'wh-kotsyubinske') {
                                        stockMain = stockVal;
                                    } else {
                                        stockWarehouses[warehouseId] = stockVal;
                                    }

                                    // Update our tracking map
                                    warehouseStockDates[warehouseId] = { dateScore, val: stockVal };
                                    console.log(`[Excel Import] STOCK SAVED/UPDATED "${header}" -> ${warehouseId}: ${stockVal} (DateScore: ${dateScore})`);
                                } else {
                                    console.log(`[Excel Import] IGNORING OLD DATA "${header}" -> ${warehouseId}. Current DateScore: ${existing.dateScore}, New: ${dateScore}`);
                                }
                            } else {
                                console.log(`[Excel Import] EMPTY/INVALID VALUE "${header}" -> ${warehouseId}. Keeping previous value if any.`);
                            }

                        } else {
                            console.warn(`[Excel Import] Unknown warehouse name in column "${header}": "${warehouseName}"`);
                        }
                        continue;
                    } else {
                        console.log(`[Import Debug] Header "${header}" contained keywords but failed Regex match.`);
                    }

                    // Fallback: старый формат "залишки на 1 число, [склад]"
                    // Check for 1С/база - это ОБЩИЙ остаток
                    if ((headerLower.includes('1с') || headerLower.includes('1 с') || headerLower.includes('1c') || headerLower.includes('база')) &&
                        !headerLower.includes('май') && !headerLower.includes('тс') && !headerLower.includes('ts') &&
                        !headerLower.includes('фито') && !headerLower.includes('фіто') && !headerLower.includes('фото') &&
                        !headerLower.includes('коцюбинське') && !headerLower.includes('коцюбинское') &&
                        !headerLower.includes('кава') && !headerLower.includes('бакалея')) {
                        stockMain = stockVal ?? 0;
                    }
                    // Check for Коцюбинське - отдельная колонка
                    else if ((headerLower.includes('коцюбинське') || headerLower.includes('коцюбинское')) &&
                        !headerLower.includes('1с') && !headerLower.includes('1 с') && !headerLower.includes('1c')) {
                        if (stockMain === 0) {
                            stockMain = stockVal ?? 0;
                        }
                    }
                    // Check for ТС/Май
                    else if ((headerLower.includes('май') || (headerLower.includes('тс') && !headerLower.includes('трейд'))) &&
                        !headerLower.includes('1с') && !headerLower.includes('1 с') && !headerLower.includes('1c') &&
                        !headerLower.includes('коцюбинське') && !headerLower.includes('коцюбинское')) {
                        stockWarehouses['wh-ts'] = stockVal ?? 0;
                    }
                    // Check for Фито/Фото
                    else if ((headerLower.includes('фито') || headerLower.includes('фіто') || headerLower.includes('fito') ||
                        headerLower.includes('фото') || headerLower.includes('photo')) &&
                        !headerLower.includes('1с') && !headerLower.includes('1 с') && !headerLower.includes('1c')) {
                        stockWarehouses['wh-fito'] = stockVal ?? 0;
                    }
                    // Check for Кава
                    else if (headerLower.includes('кава') || headerLower.includes('kava')) {
                        stockWarehouses['wh-kava'] = stockVal ?? 0;
                    }
                    // Check for Бакалея
                    else if (headerLower.includes('бакалея') || headerLower.includes('bakaleya')) {
                        stockWarehouses['wh-bakaleya'] = stockVal ?? 0;
                    }
                    // Check for ТС Трейд
                    else if (headerLower.includes('тс трейд') || headerLower.includes('ts treyd')) {
                        stockWarehouses['wh-ts-treyd'] = stockVal ?? 0;
                    }
                }

                // Find base norm (эталон) column
                const baseNormStr = findColumn(row, [
                    'Базовая норма', 'Базова норма', 'Еталон', 'Эталон', 'Норма', 'Norm',
                    'Базовая норма расхода', 'Базова норма витрат', 'Еталонна норма'
                ]);
                const baseNorm = baseNormStr ? parseFloat(String(baseNormStr).replace(',', '.')) || 0 : undefined;

                // Find planned consumption and actual consumption columns
                // Под прошедшими месяцами - фактический расход
                // Под будущим и текущим месяцем - плановый расход
                const plannedConsumption: Array<{ date: string; quantity: number; isActual?: boolean }> = [];

                const now = new Date();
                const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);

                // Parse date columns (e.g., "01.12.2025", "01.01.2026") - these are consumption columns
                const datePattern = /\d{2}\.\d{2}\.\d{4}/;
                for (let i = 0; i < headers.length; i++) {
                    const header = String(headers[i] || '').trim();
                    const headerLower = header.toLowerCase();

                    // Skip stock columns
                    if (headerLower.includes('залишки') || headerLower.includes('зал') || headerLower.includes('остаток')) {
                        continue;
                    }

                    // Check if this is a date column (DD.MM.YYYY format)
                    const dateMatch = String(header || '').match(datePattern);
                    if (dateMatch) {
                        // Parse date from header (DD.MM.YYYY)
                        const dateParts = dateMatch[0].split('.');
                        if (dateParts.length === 3) {
                            const day = parseInt(dateParts[0]);
                            const month = parseInt(dateParts[1]);
                            const year = parseInt(dateParts[2]);

                            if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
                                const monthDate = `${year}-${String(month).padStart(2, '0')}-01`;
                                const monthDateObj = new Date(year, month - 1, 1);

                                // Determine if this is actual (past month) or planned (current/future month)
                                const isActual = monthDateObj < currentMonth;

                                const value = row[headers[i]] || row[`__EMPTY_${i}`];
                                const quantity = Number(value) || 0;

                                if (quantity > 0) {
                                    plannedConsumption.push({
                                        date: monthDate,
                                        quantity,
                                        isActual
                                    });
                                    console.log(`[Excel Import] Item "${name}" (code: ${code}): Date column "${header}" -> ${monthDate}, quantity: ${quantity}, isActual: ${isActual}`);
                                }
                            }
                        }
                        continue; // Skip to next column
                    }

                    // Parse month name columns (октябрь 2024, ноябрь 2024 и т.д.)
                    // Skip if it's explicitly "план витрат" or "залишки"
                    if (headerLower.includes('план') && (headerLower.includes('витрат') || headerLower.includes('расход'))) {
                        continue;
                    }

                    // Try to parse month name from header
                    const monthMatch = headerLower.match(/(январь|февраль|март|апрель|май|июнь|июль|август|сентябрь|октябрь|ноябрь|декабрь|січень|лютий|березень|квітень|травень|червень|липень|серпень|вересень|жовтень|листопад|грудень)\s*(\d{4})?/);
                    if (monthMatch) {
                        const monthName = monthMatch[1];
                        const year = monthMatch[2] ? parseInt(monthMatch[2]) : now.getFullYear();

                        const monthMap: Record<string, number> = {
                            'январь': 1, 'января': 1, 'січень': 1, 'січня': 1,
                            'февраль': 2, 'февраля': 2, 'лютий': 2, 'лютого': 2,
                            'март': 3, 'марта': 3, 'березень': 3, 'березня': 3,
                            'апрель': 4, 'апреля': 4, 'квітень': 4, 'квітня': 4,
                            'май': 5, 'мая': 5, 'травень': 5, 'травня': 5,
                            'июнь': 6, 'июня': 6, 'червень': 6, 'червня': 6,
                            'июль': 7, 'июля': 7, 'липень': 7, 'липня': 7,
                            'август': 8, 'августа': 8, 'серпень': 8, 'серпня': 8,
                            'сентябрь': 9, 'сентября': 9, 'вересень': 9, 'вересня': 9,
                            'октябрь': 10, 'октября': 10, 'жовтень': 10, 'жовтня': 10,
                            'ноябрь': 11, 'ноября': 11, 'листопад': 11, 'листопада': 11,
                            'декабрь': 12, 'декабря': 12, 'грудень': 12, 'грудня': 12
                        };

                        const month = monthMap[monthName.toLowerCase()];
                        if (month) {
                            const monthDate = `${year}-${String(month).padStart(2, '0')}-01`;
                            const monthDateObj = new Date(year, month - 1, 1);

                            // Determine if this is actual (past month) or planned (current/future month)
                            const isActual = monthDateObj < currentMonth;

                            const value = row[headers[i]] || row[`__EMPTY_${i}`];
                            const quantity = Number(value) || 0;

                            if (quantity > 0) {
                                plannedConsumption.push({
                                    date: monthDate,
                                    quantity,
                                    isActual
                                });
                                console.log(`[Excel Import] Item "${name}" (code: ${code}): Column ${i} "${header}" -> ${monthDate}, quantity: ${quantity}, isActual: ${isActual}`);
                            }
                        }
                    }
                }

                // Also check for explicit "план витрат" columns (for backward compatibility)
                for (let i = 0; i < headers.length; i++) {
                    const header = String(headers[i] || '').trim();
                    const headerLower = header.toLowerCase();

                    // Check if this is a planned consumption column
                    const isPlannedConsumption = (headerLower.includes('план') && (headerLower.includes('витрат') || headerLower.includes('расход'))) ||
                        headerLower.includes('план витрат') || headerLower.includes('план расход');

                    if (isPlannedConsumption) {
                        // ONLY use if we have month mapped from row above
                        if (columnToMonthMap.has(i)) {
                            const monthDate = columnToMonthMap.get(i)!;
                            const monthDateObj = new Date(monthDate);
                            const isActual = monthDateObj < currentMonth;

                            const value = row[headers[i]] || row[`__EMPTY_${i}`];
                            const quantity = Number(value) || 0;

                            // Only add non-zero quantities
                            if (quantity > 0) {
                                // Check if we already have this month from month name columns
                                const existing = plannedConsumption.find(pc => pc.date === monthDate);
                                if (!existing) {
                                    plannedConsumption.push({ date: monthDate, quantity, isActual });
                                    console.log(`[Excel Import] Item "${name}" (code: ${code}): Column ${i} "${header}" -> ${monthDate}, quantity: ${quantity}, isActual: ${isActual}`);
                                }
                            }
                        }
                    }
                }

                const result: ParsedItem = {
                    code: code,
                    name: name,
                    unit: unit,
                    category: category,
                    stockMain: isNaN(stockMain) ? 0 : stockMain,
                    stockWarehouses: stockWarehouses,
                    storageLocation: storageLocation || undefined,
                    baseNorm: baseNorm,
                    // Always include plannedConsumption array, even if empty (for debugging)
                    plannedConsumption: plannedConsumption,
                };

                // Debug logging for planned consumption
                if (plannedConsumption.length > 0) {
                    console.log(`[Planned Consumption Debug] Item "${name}" (code: ${code}):`, plannedConsumption);
                }

                // Debug logging for stock parsing
                if (stockMain > 0 || Object.keys(stockWarehouses).length > 0) {
                    console.log(`[Stock Debug] Item "${name}" (code: ${code}): stockMain=${stockMain}, stockWarehouses=`, stockWarehouses);
                }

                // Debug logging if category doesn't match group (e.g., картон -> envelope)
                if (groupValue && groupValue.toLowerCase().includes('картон') && category !== 'packaging_cardboard') {
                    console.warn(`[Category Mismatch] Item "${name}" (code: ${code}): groupValue="${groupValue}" but category="${category}"`);
                }

                // Debug logging for flavor and sticker categories
                if (category === 'flavor') {
                    console.log(`[Category Debug] Parsed item "${name}" (code: ${code}) -> category: ${category}, groupValue: "${groupValue}"`);
                }
                if (category === 'sticker') {
                    console.log(`[Category Debug] Parsed item "${name}" (code: ${code}) -> category: ${category}, groupValue: "${groupValue}"`);
                }

                return result;
            }).filter((i): i is ParsedItem => {
                // Skip null items (from early return)
                if (!i) return false;
                // Skip items with empty or invalid names
                if (!i.name || i.name.trim() === '' || i.name === 'Unknown') return false;
                // Skip items where name is just "0" or starts with "0" as placeholder
                const nameTrimmed = i.name.trim();
                if (nameTrimmed === '0' || nameTrimmed === '0 ') return false;
                if (!i.code || i.code.trim() === '') {
                    console.log(`[Import Skipped] Item "${i.name}" skipped: missing code`);
                    return false;
                }
                return true;
            });

            if (items.length === 0) {
                // Show found columns for debugging
                const foundColumns = columnNames.length > 0
                    ? columnNames.join(', ')
                    : headers.filter((h: string) => h && !h.startsWith('__EMPTY')).join(', ') || 'не найдены';

                setError(
                    `Не удалось найти данные. Найдены колонки: ${foundColumns}\n\n` +
                    `Ожидаются колонки с названиями:\n` +
                    `- Код / Code / SKU / Артикул (обязательно)\n` +
                    `- Наименование / Name / Название / Назва / Товар (обязательно)\n` +
                    `- Ед. изм. / Unit / Единица (опционально)\n` +
                    `- Склад / Stock Main / Остаток / Зал. на 1 число, 1С / залишки на 1 число, 1С (опционально)\n` +
                    `- Цех / Stock Prod / зал. на 1 число ТС (опционально)\n\n` +
                    `Проверьте:\n` +
                    `1. Что первая строка содержит заголовки колонок\n` +
                    `2. Что названия колонок совпадают (регистр не важен)\n` +
                    `3. Что в файле есть данные (не только заголовки)`
                );
                setLoading(false);
                return;
            }

            // Extract unique suppliers from "Поставщик" or "Supplier" column
            const suppliersMap = new Map<string, ParsedSupplier>();
            data.forEach((row: any) => {
                const supplierName = findColumn(row, [
                    'Supplier', 'Поставщик', 'Постачальник', 'Основний постачальник',
                    'Основной поставщик', 'Supplier Name', 'Поставщик товара',
                    'Постачальник товара', 'SupplierName', 'ПоставщикТовара'
                ])?.trim();

                if (supplierName && supplierName !== '' && supplierName !== '0') {
                    const nameLower = supplierName.toLowerCase();
                    if (!suppliersMap.has(nameLower)) {
                        suppliersMap.set(nameLower, { name: supplierName });
                    }
                }
            });

            const suppliers = Array.from(suppliersMap.values());
            console.log(`Найдено ${suppliers.length} уникальных поставщиков`);

            setParsedData(items);
            setParsedSuppliers(suppliers);
            setStep('preview');
            setError(null);
            setLoading(false);
        } catch (err) {
            console.error(err);
            setError('Ошибка при обработке данных. Проверьте формат файла.');
            setLoading(false);
        }
    };


    const handleImport = async () => {
        setStep('importing');
        setError(null);
        try {
            console.log('Начинаем импорт данных...', parsedData.length, 'позиций');

            // Import materials first
            await inventoryService.importData(parsedData);
            console.log('Материалы импортированы');

            // Import suppliers if any
            if (parsedSuppliers.length > 0) {
                console.log('Импортируем поставщиков...', parsedSuppliers.length);
                await inventoryService.importSuppliers(parsedSuppliers);
                console.log('Поставщики импортированы');
            }

            console.log('Импорт завершен, обновляем список...');
            await refresh(); // Reload inventory list

            // Notify other tabs/components about the update
            localStorage.setItem('inventory_updated', Date.now().toString());
            localStorage.setItem('planned_consumption_updated', Date.now().toString());

            setStep('success');
        } catch (err: any) {
            console.error('Ошибка импорта:', err);
            const errorMessage = err?.message || 'Ошибка при сохранении в базу данных. Проверьте консоль браузера (F12) для деталей.';
            setError(errorMessage);
            setStep('preview');
        }
    };

    const handleClose = () => {
        setStep('upload');
        setParsedData([]);
        setError(null);
        setSheetNames([]);
        setSelectedSheet('');
        setLoading(false);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={handleClose} title={t('excel.title')}>
            <div className="space-y-6">
                {step === 'upload' && (
                    <div className="space-y-4">
                        <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-700 rounded-xl p-10 bg-slate-800/30 hover:bg-slate-800/50 transition-colors">
                            <FileSpreadsheet className="w-12 h-12 text-emerald-500 mb-4" />
                            <h3 className="text-lg font-medium text-slate-200 mb-2">{t('excel.uploadFile')}</h3>
                            <p className="text-sm text-slate-400 text-center mb-6 max-w-md">
                                {t('excel.uploadDescription')}
                            </p>
                            <p className="text-xs text-slate-500 text-center mb-4 max-w-md">
                                {t('excel.expectedColumns')}
                            </p>
                            <input
                                type="file"
                                accept=".xlsx, .xls"
                                className="hidden"
                                id="file-upload"
                                onChange={handleFileUpload}
                                disabled={loading || !isOpen}
                            />
                            <label
                                htmlFor="file-upload"
                                className={`cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-lg font-medium transition-colors inline-flex items-center ${loading || !isOpen ? 'opacity-50 cursor-not-allowed' : ''}`}
                                onClick={(e) => {
                                    if (loading || !isOpen) {
                                        e.preventDefault();
                                    }
                                }}
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        {t('excel.processing')}
                                    </>
                                ) : (
                                    <>
                                        <Upload className="w-4 h-4 mr-2" />
                                        {t('excel.selectFile')}
                                    </>
                                )}
                            </label>
                        </div>

                        {/* Sheet Selector */}
                        {sheetNames.length > 1 && !selectedSheet && (
                            <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                                <h4 className="text-sm font-medium text-slate-300 mb-3">
                                    {t('excel.selectSheet')} ({sheetNames.length} {t('excel.sheetsFound')}):
                                </h4>
                                <div className="space-y-2">
                                    {sheetNames.map((sheet) => (
                                        <button
                                            key={sheet}
                                            onClick={() => {
                                                setSelectedSheet(sheet);
                                                // Re-read file to parse selected sheet
                                                const fileInput = document.getElementById('file-upload') as HTMLInputElement;
                                                if (fileInput?.files?.[0]) {
                                                    const file = fileInput.files[0];
                                                    const reader = new FileReader();
                                                    reader.onload = (evt) => {
                                                        try {
                                                            const bstr = evt.target?.result;
                                                            const wb = XLSX.read(bstr, {
                                                                type: 'binary',
                                                                cellText: true,
                                                                dense: false
                                                            });
                                                            parseSheet(wb, sheet);
                                                        } catch (err) {
                                                            console.error(err);
                                                            setError('Ошибка при чтении выбранной вкладки.');
                                                        }
                                                    };
                                                    reader.readAsBinaryString(file);
                                                }
                                            }}
                                            className="w-full text-left px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-200 transition-colors"
                                        >
                                            {sheet}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {error && (
                            <div className="p-3 bg-red-900/20 border border-red-900/50 rounded-lg flex items-center text-red-400 text-sm">
                                <AlertTriangle className="w-4 h-4 mr-2 flex-shrink-0" />
                                {error}
                            </div>
                        )}
                    </div>
                )}

                {step === 'preview' && (
                    <div className="space-y-4">
                        {error && (
                            <div className="p-3 bg-red-900/20 border border-red-900/50 rounded-lg flex items-start text-red-400 text-sm">
                                <AlertTriangle className="w-4 h-4 mr-2 flex-shrink-0 mt-0.5" />
                                <div className="flex-1 whitespace-pre-wrap">{error}</div>
                            </div>
                        )}
                        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                            <h4 className="text-sm font-medium text-slate-300 mb-3 flex justify-between items-center">
                                <span>{t('excel.itemsFound')} {parsedData.length}</span>
                                <span className="text-xs text-emerald-400 bg-emerald-900/20 px-2 py-1 rounded">{t('excel.preview')}</span>
                            </h4>
                            {parsedSuppliers.length > 0 && (
                                <p className="text-xs text-blue-400 mb-3">
                                    {t('excel.suppliersFound') || 'Найдено поставщиков'}: {parsedSuppliers.length}
                                </p>
                            )}
                            <div className="overflow-x-auto">
                                {(() => {
                                    // Collect all unique months from planned consumption
                                    const allMonths = new Set<string>();
                                    parsedData.forEach(item => {
                                        if (item.plannedConsumption && item.plannedConsumption.length > 0) {
                                            item.plannedConsumption.forEach(pc => {
                                                // Extract month from date (YYYY-MM-01 or YYYY-MM-DD)
                                                const monthMatch = pc.date.match(/^(\d{4})-(\d{2})/);
                                                if (monthMatch) {
                                                    const [, year, month] = monthMatch;
                                                    allMonths.add(`${year}-${month}`);
                                                }
                                            });
                                        }
                                    });
                                    const sortedMonths = Array.from(allMonths).sort();

                                    // Helper to format month name
                                    const formatMonth = (monthStr: string) => {
                                        const [year, month] = monthStr.split('-');
                                        const date = new Date(parseInt(year), parseInt(month) - 1, 1);
                                        return date.toLocaleDateString(language === 'uk' ? 'uk-UA' : 'ru-RU', { month: 'long', year: 'numeric' });
                                    };

                                    // Helper to get planned consumption for a specific month
                                    const getPlannedForMonth = (item: ParsedItem, monthStr: string) => {
                                        if (!item.plannedConsumption || item.plannedConsumption.length === 0) return 0;
                                        const found = item.plannedConsumption.find(pc => {
                                            const monthMatch = pc.date.match(/^(\d{4})-(\d{2})/);
                                            return monthMatch && `${monthMatch[1]}-${monthMatch[2]}` === monthStr;
                                        });
                                        return found ? found.quantity : 0;
                                    };

                                    // Собираем все уникальные склады из всех элементов
                                    const allWarehouses = new Set<string>();
                                    parsedData.forEach(item => {
                                        Object.keys(item.stockWarehouses).forEach(wh => allWarehouses.add(wh));
                                    });
                                    const warehouseNames: Record<string, string> = {
                                        'wh-kotsyubinske': 'База',
                                        'wh-ts': 'ТС',
                                        'wh-fito': 'Фіто',
                                        'wh-kava': 'Кава',
                                        'wh-bakaleya': 'Бакалея',
                                        'wh-ts-treyd': 'ТС Трейд'
                                    };
                                    const sortedWarehouses = Array.from(allWarehouses).sort();

                                    return (
                                        <table className="w-full text-sm text-left">
                                            <thead className="text-xs text-slate-400 uppercase bg-slate-900/50">
                                                <tr>
                                                    <th className="px-3 py-2">{t('materials.code')}</th>
                                                    <th className="px-3 py-2">{t('materials.name')}</th>
                                                    <th className="px-3 py-2">{t('materials.category')}</th>
                                                    <th className="px-3 py-2 text-right">База</th>
                                                    {sortedWarehouses.map(wh => (
                                                        <th key={wh} className="px-3 py-2 text-right">
                                                            {warehouseNames[wh] || wh}
                                                        </th>
                                                    ))}
                                                    {sortedMonths.map(monthStr => (
                                                        <th key={monthStr} className="px-3 py-2 text-right text-blue-400" title={formatMonth(monthStr)}>
                                                            {formatMonth(monthStr)}
                                                        </th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-700">
                                                {parsedData.slice(0, 5).map((item, idx) => (
                                                    <tr key={idx} className="text-slate-300">
                                                        <td className="px-3 py-2 font-mono text-xs text-slate-500">{item.code}</td>
                                                        <td className="px-3 py-2">{item.name}</td>
                                                        <td className="px-3 py-2 text-slate-500">{item.category}</td>
                                                        <td className="px-3 py-2 text-right font-medium">{item.stockMain}</td>
                                                        {sortedWarehouses.map(wh => (
                                                            <td key={wh} className="px-3 py-2 text-right font-medium">
                                                                {item.stockWarehouses[wh] || '-'}
                                                            </td>
                                                        ))}
                                                        {sortedMonths.map(monthStr => {
                                                            const qty = getPlannedForMonth(item, monthStr);
                                                            return (
                                                                <td key={monthStr} className="px-3 py-2 text-right font-medium text-blue-400">
                                                                    {qty > 0 ? qty : '-'}
                                                                </td>
                                                            );
                                                        })}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    );
                                })()}
                            </div>
                        </div>
                        <div className="flex justify-end gap-3">
                            <Button variant="ghost" onClick={() => setStep('upload')}>{t('excel.back')}</Button>
                            <Button onClick={handleImport} className="bg-emerald-600 hover:bg-emerald-700">
                                <Upload className="w-4 h-4 mr-2" />
                                {t('excel.import')}
                            </Button>
                        </div>
                    </div>
                )}

                {step === 'importing' && (
                    <div className="flex flex-col items-center justify-center py-12">
                        <Loader2 className="w-10 h-10 text-emerald-500 animate-spin mb-4" />
                        <h3 className="text-lg font-medium text-slate-200">{t('excel.importing')}</h3>
                        <p className="text-slate-400 mt-2">{t('excel.importingDesc')}</p>
                        <p className="text-xs text-slate-500 mt-4">{t('excel.importingTime')}</p>
                    </div>
                )}

                {step === 'success' && (
                    <div className="flex flex-col items-center justify-center py-8">
                        <div className="w-16 h-16 bg-emerald-900/30 rounded-full flex items-center justify-center mb-4">
                            <Check className="w-8 h-8 text-emerald-500" />
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">{t('excel.success')}</h3>
                        <p className="text-slate-400 text-center mb-6">
                            {t('excel.successDesc')} {parsedData.length} {t('excel.successItems')}
                            {parsedSuppliers.length > 0 && (
                                <><br />{t('excel.suppliersImported') || 'Импортировано поставщиков'}: {parsedSuppliers.length}</>
                            )}
                        </p>
                        <Button onClick={handleClose} className="bg-slate-700 hover:bg-slate-600 min-w-[120px]">
                            {t('excel.close')}
                        </Button>
                    </div>
                )}
            </div>
        </Modal>
    );
}
