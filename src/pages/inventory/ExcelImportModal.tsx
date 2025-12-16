import { useState } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Upload, FileSpreadsheet, Check, AlertTriangle, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { inventoryService } from '../../services/inventoryService';
import { useInventory } from '../../hooks/useInventory';

interface ExcelImportModalProps {
    isOpen: boolean;
    onClose: () => void;
}

interface ParsedItem {
    code: string;
    name: string;
    unit: string;
    category: string;
    stockMain: number;
    stockProd: number;
}

export default function ExcelImportModal({ isOpen, onClose }: ExcelImportModalProps) {
    const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'success'>('upload');
    const [parsedData, setParsedData] = useState<ParsedItem[]>([]);
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

            // Convert to JSON - handle large files efficiently
            const data = XLSX.utils.sheet_to_json(ws, {
                defval: '', // Default value for empty cells
                raw: false // Get formatted values (calculated formulas)
            });

            // Flexible column mapping (supports both English and Russian headers)
            const items: ParsedItem[] = data.map((row: any) => {
                // Try multiple column name variations
                const code = row['Code'] || row['Код'] || row['SKU'] || row['Артикул'] || row['Арт.'] || '';
                const name = row['Name'] || row['Наименование'] || row['Название'] || row['Товар'] || 'Unknown';
                const unit = row['Unit'] || row['Ед. изм.'] || row['Единица'] || row['Ед'] || 'шт';
                const category = row['Category'] || row['Категория'] || row['Группа'] || 'tea_bulk';
                
                // Try multiple stock column variations
                const stockMain = Number(
                    row['Stock Main'] || row['Склад'] || row['Остаток'] || 
                    row['Остаток на складе'] || row['Склад Главный'] || 0
                );
                const stockProd = Number(
                    row['Stock Prod'] || row['Цех'] || row['Производство'] || 
                    row['Склад Цех'] || 0
                );

                return {
                    code: String(code).trim(),
                    name: String(name).trim(),
                    unit: String(unit).trim(),
                    category: String(category).trim(),
                    stockMain: isNaN(stockMain) ? 0 : stockMain,
                    stockProd: isNaN(stockProd) ? 0 : stockProd,
                };
            }).filter(i => i.name !== 'Unknown' && i.name !== '' && i.code !== '');

            if (items.length === 0) {
                setError('Не удалось найти данные. Проверьте заголовки (Код, Наименование, Ед. изм., Остаток)');
                setLoading(false);
                return;
            }

            setParsedData(items);
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
        try {
            await inventoryService.importData(parsedData);
            await refresh(); // Reload inventory list
            setStep('success');
        } catch (err) {
            console.error(err);
            setError('Ошибка при сохранении в базу данных.');
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
        <Modal isOpen={isOpen} onClose={handleClose} title="Импорт из Excel">
            <div className="space-y-6">
                {step === 'upload' && (
                    <div className="space-y-4">
                        <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-700 rounded-xl p-10 bg-slate-800/30 hover:bg-slate-800/50 transition-colors">
                            <FileSpreadsheet className="w-12 h-12 text-emerald-500 mb-4" />
                            <h3 className="text-lg font-medium text-slate-200 mb-2">Загрузите файл Excel</h3>
                            <p className="text-sm text-slate-400 text-center mb-6 max-w-md">
                                Файл может быть большим и содержать несколько вкладок. Поддерживаются формулы - будут использованы вычисленные значения.
                            </p>
                            <p className="text-xs text-slate-500 text-center mb-4 max-w-md">
                                Ожидаемые колонки: Код/Code, Наименование/Name, Категория/Category, Ед. изм./Unit, Склад/Stock
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
                                        Обработка...
                                    </>
                                ) : (
                                    <>
                                        <Upload className="w-4 h-4 mr-2" />
                                        Выбрать файл
                                    </>
                                )}
                            </label>
                        </div>

                        {/* Sheet Selector */}
                        {sheetNames.length > 1 && !selectedSheet && (
                            <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                                <h4 className="text-sm font-medium text-slate-300 mb-3">
                                    Выберите вкладку для импорта ({sheetNames.length} найдено):
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
                        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                            <h4 className="text-sm font-medium text-slate-300 mb-3 flex justify-between items-center">
                                <span>Найдено позиций: {parsedData.length}</span>
                                <span className="text-xs text-emerald-400 bg-emerald-900/20 px-2 py-1 rounded">Предпросмотр (первые 5)</span>
                            </h4>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="text-xs text-slate-400 uppercase bg-slate-900/50">
                                        <tr>
                                            <th className="px-3 py-2">Код</th>
                                            <th className="px-3 py-2">Наименование</th>
                                            <th className="px-3 py-2">Категория</th>
                                            <th className="px-3 py-2 text-right">Склад</th>
                                            <th className="px-3 py-2 text-right">Цех</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-700">
                                        {parsedData.slice(0, 5).map((item, idx) => (
                                            <tr key={idx} className="text-slate-300">
                                                <td className="px-3 py-2 font-mono text-xs text-slate-500">{item.code}</td>
                                                <td className="px-3 py-2">{item.name}</td>
                                                <td className="px-3 py-2 text-slate-500">{item.category}</td>
                                                <td className="px-3 py-2 text-right font-medium">{item.stockMain}</td>
                                                <td className="px-3 py-2 text-right font-medium">{item.stockProd}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3">
                            <Button variant="ghost" onClick={() => setStep('upload')}>Назад</Button>
                            <Button onClick={handleImport} className="bg-emerald-600 hover:bg-emerald-700">
                                <Upload className="w-4 h-4 mr-2" />
                                Импортировать в базу
                            </Button>
                        </div>
                    </div>
                )}

                {step === 'importing' && (
                    <div className="flex flex-col items-center justify-center py-12">
                        <Loader2 className="w-10 h-10 text-emerald-500 animate-spin mb-4" />
                        <h3 className="text-lg font-medium text-slate-200">Импорт данных...</h3>
                        <p className="text-slate-400 mt-2">Сохраняем позиции и обновляем остатки...</p>
                    </div>
                )}

                {step === 'success' && (
                    <div className="flex flex-col items-center justify-center py-8">
                        <div className="w-16 h-16 bg-emerald-900/30 rounded-full flex items-center justify-center mb-4">
                            <Check className="w-8 h-8 text-emerald-500" />
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">Готово!</h3>
                        <p className="text-slate-400 text-center mb-6">
                            Успешно импортировано {parsedData.length} позиций.
                        </p>
                        <Button onClick={handleClose} className="bg-slate-700 hover:bg-slate-600 min-w-[120px]">
                            Закрыть
                        </Button>
                    </div>
                )}
            </div>
        </Modal>
    );
}
