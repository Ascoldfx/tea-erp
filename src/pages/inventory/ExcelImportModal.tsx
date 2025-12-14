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
    const { refresh } = useInventory();

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws);

                // Simple mapping strategy (flexible for column names)
                const items: ParsedItem[] = data.map((row: any) => ({
                    code: row['Code'] || row['Код'] || row['SKU'] || '',
                    name: row['Name'] || row['Наименование'] || row['Название'] || 'Unknown',
                    unit: row['Unit'] || row['Ед. изм.'] || row['Единица'] || 'кг',
                    category: row['Category'] || row['Категория'] || 'tea_bulk', // Default fallback
                    stockMain: Number(row['Stock Main'] || row['Склад'] || row['Остаток'] || 0),
                    stockProd: Number(row['Stock Prod'] || row['Цех'] || 0),
                })).filter(i => i.name !== 'Unknown');

                if (items.length === 0) {
                    setError('Не удалось найти данные. Проверьте заголовки (Код, Наименование, Ед. изм., Остаток)');
                    return;
                }

                setParsedData(items);
                setStep('preview');
                setError(null);
            } catch (err) {
                console.error(err);
                setError('Ошибка чтения файла. Убедитесь, что это валидный Excel.');
            }
        };
        reader.readAsBinaryString(file);
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
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={handleClose} title="Импорт из Excel">
            <div className="space-y-6">
                {step === 'upload' && (
                    <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-700 rounded-xl p-10 bg-slate-800/30 hover:bg-slate-800/50 transition-colors">
                        <FileSpreadsheet className="w-12 h-12 text-emerald-500 mb-4" />
                        <h3 className="text-lg font-medium text-slate-200 mb-2">Загрузите файл Excel</h3>
                        <p className="text-sm text-slate-400 text-center mb-6 max-w-xs">
                            Файл должен содержать колонки: Код, Наименование, Категория, Ед. изм., Склад
                        </p>
                        <input
                            type="file"
                            accept=".xlsx, .xls"
                            className="hidden"
                            id="file-upload"
                            onChange={handleFileUpload}
                        />
                        <label
                            htmlFor="file-upload"
                            className="cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-lg font-medium transition-colors inline-flex items-center"
                        >
                            <Upload className="w-4 h-4 mr-2" />
                            Выбрать файл
                        </label>
                        {error && (
                            <div className="mt-4 p-3 bg-red-900/20 border border-red-900/50 rounded-lg flex items-center text-red-400 text-sm">
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
