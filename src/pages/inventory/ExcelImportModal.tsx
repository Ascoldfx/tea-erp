import { useState } from 'react';
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
    stockMain: number; // Общий остаток (1С) - для картонной упаковки это общий остаток
    stockMai: number; // ТС (если есть отдельная колонка)
    stockFito: number; // Фито (если есть отдельная колонка)
    storageLocation?: string; // Место хранения из Excel
    plannedConsumption?: Array<{
        date: string; // YYYY-MM-DD (первый день месяца)
        quantity: number;
    }>;
}

interface ParsedSupplier {
    name: string;
}

export default function ExcelImportModal({ isOpen, onClose }: ExcelImportModalProps) {
    const { t } = useLanguage();
    const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'success'>('upload');
    const [parsedData, setParsedData] = useState<ParsedItem[]>([]);
    const [parsedSuppliers, setParsedSuppliers] = useState<ParsedSupplier[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [sheetNames, setSheetNames] = useState<string[]>([]);
    const [selectedSheet, setSelectedSheet] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const { refresh } = useInventory();

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
                        if (key.trim().toLowerCase() === name.toLowerCase()) {
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
            headers.forEach((header, index) => {
                if (datePattern.test(String(header || ''))) {
                    dateColumnIndices.push(index);
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
                
                // Also check name for category hints if group value is empty
                const nameLower = name ? String(name).toLowerCase() : '';
                
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
                // 2. Ярлыки - ТОЛЬКО если явно указано в группе (строгая проверка)
                else if (groupValue === 'label' || groupValue === 'ярлик' || groupValue === 'ярлыки' || groupValue === 'ярлики' ||
                         groupValue.startsWith('ярлик') || groupValue.includes(' ярлик')) {
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
                // 4. Конверты - отдельная категория
                else if (groupValue === 'envelope' || groupValue === 'конверт' || groupValue === 'конверты' || groupValue === 'конверти' ||
                         groupValue.startsWith('конверт') || groupValue.includes(' конверт') || nameLower.includes('конверт')) {
                    category = 'envelope';
                }
                // 5. Картонная упаковка - отдельная категория (проверяем ПЕРЕД общей упаковкой)
                else if (groupValue === 'картон' || groupValue.includes('картон') || groupValue.includes('картонн') ||
                         groupValue === 'packaging_cardboard') {
                    category = 'packaging_cardboard';
                }
                // 5a. Коробки и пачки (если не картон)
                else if (groupValue === 'packaging_box' || groupValue === 'коробка' || groupValue === 'коробки' ||
                         (groupValue.includes('коробк') && !groupValue.includes('гофро') && !groupValue.includes('картон'))) {
                    category = 'packaging_box';
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
                // 8. Пачки - отдельная категория (проверяем ПЕРЕД общей упаковкой)
                else if (groupValue === 'пачка' || groupValue === 'пачки' || groupValue.startsWith('пачка') ||
                         (groupValue.includes('пачка') && !groupValue.includes('упаковк'))) {
                    category = 'packaging_box';
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
                // 11. Если значение существует, но не совпадает с известными категориями
                // Сохраняем его как динамическую категорию (нормализованную)
                else {
                    const validCategories: string[] = ['tea_bulk', 'flavor', 'packaging_consumable', 'packaging_box', 'packaging_crate', 'label', 'sticker', 'soft_packaging', 'envelope', 'packaging_cardboard', 'other'];
                    if (validCategories.includes(groupValue)) {
                        category = groupValue as any;
                    } else {
                        // If unknown category, normalize and use it as dynamic category
                        // Normalize: lowercase, trim, replace spaces with underscores, remove special chars
                        const normalizedGroup = groupValue
                            .toLowerCase()
                            .trim()
                            .replace(/\s+/g, '_')
                            .replace(/[^a-z0-9_а-яёіїє]/g, '')
                            .substring(0, 50); // Limit length
                        
                        if (normalizedGroup && normalizedGroup.length > 0) {
                            category = normalizedGroup;
                            console.log(`[Category Debug] Using dynamic category: "${normalizedGroup}" from groupValue: "${groupValue}"`);
                        } else {
                            // Fallback to 'other' if normalization failed
                            category = 'other';
                        }
                    }
                }
                
                // Find stock columns
                // "Залишки на 1 число, 1С" - это ОБЩИЙ остаток материала (не разбитый по складам)
                // Если есть отдельные колонки ТС (Май) и Фито - это остатки на этих складах
                let stockMain = 0; // Общий остаток (1С)
                let stockMai = 0;  // ТС (если есть отдельная колонка, может быть названа "Май" или "ТС")
                let stockFito = 0; // Фито (если есть отдельная колонка)
                
                // Find storage location column
                const storageLocation = findColumn(row, [
                    'Место хранения', 'Место хранения', 'Местонахождение', 'Локация', 'Location',
                    'Місце зберігання', 'Місцезнаходження', 'Локація'
                ]);
                
                // Look for stock columns - check all columns for stock values
                for (let i = 0; i < headers.length; i++) {
                    const header = String(headers[i] || '').toLowerCase().trim();
                    const value = row[headers[i]] || row[`__EMPTY_${i}`];
                    const numValue = Number(value) || 0;
                    
                    // Skip if this is a planned consumption column
                    if (header.includes('план') || header.includes('витрат') || header.includes('расход')) {
                        continue;
                    }
                    
                    // Skip if not a stock column
                    if (!header.includes('залишки') && !header.includes('зал') && !header.includes('остаток')) {
                        continue;
                    }
                    
                    // Check for Коцюбинське - это основной склад (может быть отдельная колонка)
                    if (header.includes('коцюбинське') || header.includes('коцюбинское') || header.includes('kotsyubinske')) {
                        if (numValue > 0) {
                            // Если это колонка "залишки на 1 число, коцюбинське" - это остаток на основном складе
                            // Но для картонной упаковки общий остаток берется из колонки "1С"
                            // Поэтому пока не используем это значение для stockMain, оставим для 1С
                        }
                    }
                    
                    // Check for 1С - это ОБЩИЙ остаток для картонной упаковки (берем максимальное значение)
                    if (header.includes('1с') || header.includes('1 с') || header.includes('1c')) {
                        if (numValue > 0) {
                            // Берем максимальное значение, если встречается несколько раз
                            stockMain = Math.max(stockMain, numValue);
                        }
                    }
                    
                    // Check for ТС (может быть названо "Май" или "ТС") - отдельный склад
                    // Важно: проверяем что это не колонка "1С" и не "коцюбинське"
                    if ((header.includes('май') || header.includes('тс') || header.includes('ts')) && 
                        !header.includes('1с') && !header.includes('1 с') && !header.includes('1c') &&
                        !header.includes('коцюбинське') && !header.includes('коцюбинское')) {
                        if (numValue > 0) {
                            // Берем максимальное значение, если встречается несколько раз
                            stockMai = Math.max(stockMai, numValue);
                        }
                    }
                    
                    // Check for Фито - отдельный склад
                    if ((header.includes('фито') || header.includes('фіто') || header.includes('fito')) && 
                        !header.includes('1с') && !header.includes('1 с') && !header.includes('1c')) {
                        if (numValue > 0) {
                            // Берем максимальное значение, если встречается несколько раз
                            stockFito = Math.max(stockFito, numValue);
                        }
                    }
                }
                
                // Fallback: try to find by exact column names
                // Для картонной упаковки колонка "1С" - это общий остаток
                if (stockMain === 0) {
                    const stockMainStr = findColumn(row, [
                        'Залишки на 1 число, 1С', 'Зал. на 1 число, 1С', 'Зал на 1 число 1С',
                        'залишки на 1 число, 1с', 'зал. на 1 число, 1с', 'залишки на 1 число, 1С',
                        'залишки на 1 число, 1 с', 'залишки на 1 число, 1С',
                        'Stock Main', 'Склад', 'Остаток', 'Остаток на складе',
                        // Также проверяем колонку "коцюбинське" как fallback для основного склада
                        // Но только если нет колонки "1С" (для картонной упаковки приоритет у "1С")
                        'залишки на 1 число, коцюбинське', 'зал. на 1 число, коцюбинське',
                        'Залишки на 1 число, Коцюбинське', 'Зал. на 1 число, Коцюбинське'
                    ]);
                    const foundValue = Number(stockMainStr) || 0;
                    if (foundValue > 0) {
                        stockMain = foundValue;
                    }
                }
                
                if (stockMai === 0) {
                    const stockMaiStr = findColumn(row, [
                        'залишки на 1 число Май', 'зал. на 1 число Май', 'залишки на 1 число май',
                        'Залишки на 1 число Май', 'Зал. на 1 число Май',
                        'залишки на 1 число ТС', 'зал. на 1 число ТС', 'залишки на 1 число тс',
                        'Залишки на 1 число ТС', 'Зал. на 1 число ТС'
                    ]);
                    stockMai = Number(stockMaiStr) || 0;
                }
                
                if (stockFito === 0) {
                    const stockFitoStr = findColumn(row, [
                        'залишки на 1 число Фито', 'зал. на 1 число Фито', 'залишки на 1 число фито',
                        'Залишки на 1 число Фито', 'Зал. на 1 число Фито', 'залишки на 1 число Φίτο',
                        // Также может быть написано "Фото" вместо "Фито"
                        'залишки на 1 число Фото', 'зал. на 1 число Фото', 'залишки на 1 число фото',
                        'Залишки на 1 число Фото', 'Зал. на 1 число Фото',
                        'залишки на 1 число, Фото', 'зал. на 1 число, Фото'
                    ]);
                    stockFito = Number(stockFitoStr) || 0;
                }

                // Find planned consumption columns - "план витрат" это плановый расход на МЕСЯЦ
                const plannedConsumption: Array<{ date: string; quantity: number }> = [];
                
                // Look for date columns and their corresponding planned consumption columns
                dateColumnIndices.forEach(dateColIndex => {
                    const dateHeader = String(headers[dateColIndex] || '').trim();
                    // Extract date from header (format: DD.MM.YYYY)
                    const dateMatch = dateHeader.match(/(\d{2})\.(\d{2})\.(\d{4})/);
                    if (dateMatch) {
                        const [, , month, year] = dateMatch; // day не используется, используем первый день месяца
                        // Use first day of the month for planned consumption (месячный план)
                        const dateStr = `${year}-${month}-01`;
                        
                        // Look for planned consumption column near this date column
                        // Usually it's in the same date group (next columns after date)
                        for (let offset = 1; offset <= 5; offset++) {
                            const colIndex = dateColIndex + offset;
                            if (colIndex >= headers.length) break;
                            
                            const colHeader = String(headers[colIndex] || '').toLowerCase().trim();
                            const colValue = row[headers[colIndex]] || row[`__EMPTY_${colIndex}`];
                            const quantity = Number(colValue) || 0;
                            
                            // Check if this is a planned consumption column
                            if ((colHeader.includes('план') && colHeader.includes('витрат')) ||
                                (colHeader.includes('план') && colHeader.includes('расход')) ||
                                colHeader.includes('план витрат')) {
                                if (quantity > 0) {
                                    plannedConsumption.push({ date: dateStr, quantity });
                                    break; // Found planned consumption for this month
                                }
                            }
                        }
                    }
                });

                const result: ParsedItem = {
                    code: code,
                    name: name,
                    unit: unit,
                    category: category,
                    stockMain: isNaN(stockMain) ? 0 : stockMain,
                    stockMai: isNaN(stockMai) ? 0 : stockMai,
                    stockFito: isNaN(stockFito) ? 0 : stockFito,
                    storageLocation: storageLocation || undefined,
                    plannedConsumption: plannedConsumption.length > 0 ? plannedConsumption : undefined,
                };
                
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
                // Skip items without code
                if (!i.code || i.code.trim() === '') return false;
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
                                disabled={loading}
                            />
                            <label
                                htmlFor="file-upload"
                                className={`cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-lg font-medium transition-colors inline-flex items-center ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
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
                                <table className="w-full text-sm text-left">
                                    <thead className="text-xs text-slate-400 uppercase bg-slate-900/50">
                                        <tr>
                                            <th className="px-3 py-2">{t('materials.code')}</th>
                                            <th className="px-3 py-2">{t('materials.name')}</th>
                                            <th className="px-3 py-2">{t('materials.category')}</th>
                                            <th className="px-3 py-2 text-right">1С</th>
                                            <th className="px-3 py-2 text-right">ТС</th>
                                            <th className="px-3 py-2 text-right">Фито</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-700">
                                        {parsedData.slice(0, 5).map((item, idx) => (
                                            <tr key={idx} className="text-slate-300">
                                                <td className="px-3 py-2 font-mono text-xs text-slate-500">{item.code}</td>
                                                <td className="px-3 py-2">{item.name}</td>
                                                <td className="px-3 py-2 text-slate-500">{item.category}</td>
                                                <td className="px-3 py-2 text-right font-medium">{item.stockMain}</td>
                                                <td className="px-3 py-2 text-right font-medium">{item.stockMai}</td>
                                                <td className="px-3 py-2 text-right font-medium">{item.stockFito}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
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
