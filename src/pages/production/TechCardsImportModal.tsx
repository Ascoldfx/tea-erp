import { useState, useEffect } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Upload, FileSpreadsheet, Check, AlertTriangle, Loader2, X } from 'lucide-react';
import * as XLSX from 'xlsx';
import { parseTechCardsFromExcel } from '../../services/techCardsExportService';
import type { ImportedTechCard } from '../../services/techCardsExportService';
import { useInventory } from '../../hooks/useInventory';
import type { Recipe, RecipeIngredient } from '../../types/production';

interface TechCardsImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onImport: (recipes: Recipe[]) => void;
}

export default function TechCardsImportModal({ isOpen, onClose, onImport }: TechCardsImportModalProps) {
    const { items } = useInventory();
    const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'success'>('upload');
    const [parsedData, setParsedData] = useState<ImportedTechCard[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [sheetNames, setSheetNames] = useState<string[]>([]);
    const [selectedSheet, setSelectedSheet] = useState<string>('');
    const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
    const [loading, setLoading] = useState(false);
    const [importedCount, setImportedCount] = useState(0);

    // Reset state when modal opens
    useEffect(() => {
        if (isOpen) {
            setStep('upload');
            setParsedData([]);
            setError(null);
            setSheetNames([]);
            setSelectedSheet('');
            setWorkbook(null);
            setLoading(false);
            setImportedCount(0);
            // Reset file input
            const fileInput = document.getElementById('tech-cards-file-upload') as HTMLInputElement;
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
                
                const wb = XLSX.read(bstr, { 
                    type: 'binary',
                    cellDates: true,
                    cellNF: false,
                    cellText: true,
                    sheetStubs: false,
                    dense: false
                });

                const sheets = wb.SheetNames;
                setSheetNames(sheets);
                setWorkbook(wb);
                
                if (sheets.length === 1) {
                    setSelectedSheet(sheets[0]);
                    parseSheet(wb, sheets[0]);
                } else {
                    setSelectedSheet('');
                    setStep('upload');
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
            const data = parseTechCardsFromExcel(wb, sheetName);
            setParsedData(data);
            setStep('preview');
            setLoading(false);
        } catch (err: any) {
            setError(err.message || 'Ошибка парсинга данных');
            setLoading(false);
        }
    };

    const handleSheetSelect = (sheetName: string) => {
        setSelectedSheet(sheetName);
        if (workbook) {
            setLoading(true);
            parseSheet(workbook, sheetName);
        }
    };

    const handleImport = async () => {
        if (parsedData.length === 0) {
            setError('Нет данных для импорта');
            return;
        }

        setStep('importing');
        setError(null);

        try {
            const recipes: Recipe[] = [];

            for (const techCard of parsedData) {
                // Находим готовую продукцию по SKU или создаем новую
                let finishedGood = items.find(i => i.sku === techCard.gpSku);
                
                // Если не найдено по SKU, ищем по названию
                if (!finishedGood) {
                    finishedGood = items.find(i => 
                        i.name.toLowerCase() === techCard.gpName.toLowerCase()
                    );
                }

                // Если не найдено, создаем временный ID
                const outputItemId = finishedGood?.id || `temp-${techCard.gpSku}`;

                const ingredients: RecipeIngredient[] = [];

                for (const ing of techCard.ingredients) {
                    // Находим материал по SKU или названию
                    let material = items.find(i => i.sku === ing.materialSku);
                    
                    if (!material) {
                        material = items.find(i => 
                            i.name.toLowerCase() === ing.materialName.toLowerCase()
                        );
                    }

                    if (material) {
                        ingredients.push({
                            itemId: material.id,
                            quantity: ing.norm
                        });
                    } else {
                        console.warn(`Материал не найден: ${ing.materialSku} - ${ing.materialName}`);
                    }
                }

                if (ingredients.length > 0) {
                    recipes.push({
                        id: `rcp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                        name: techCard.gpName,
                        description: `Импортировано из Excel. Артикул: ${techCard.gpSku}`,
                        outputItemId,
                        outputQuantity: 1,
                        ingredients
                    });
                }
            }

            setImportedCount(recipes.length);
            onImport(recipes);
            setStep('success');
        } catch (err: any) {
            setError(err.message || 'Ошибка при импорте тех.карт');
            setStep('preview');
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Импорт тех.карт из Excel"
        >
            <div className="space-y-6">
                {step === 'upload' && (
                    <div className="space-y-4">
                        <div className="border-2 border-dashed border-slate-700 rounded-lg p-8 text-center hover:border-emerald-500/50 transition-colors">
                            <input
                                id="tech-cards-file-upload"
                                type="file"
                                accept=".xlsx,.xls"
                                onChange={handleFileUpload}
                                className="hidden"
                            />
                            <label
                                htmlFor="tech-cards-file-upload"
                                className="cursor-pointer flex flex-col items-center gap-4"
                            >
                                <Upload className="w-12 h-12 text-slate-400" />
                                <div>
                                    <p className="text-slate-200 font-medium">Нажмите для загрузки файла</p>
                                    <p className="text-sm text-slate-500 mt-1">
                                        Поддерживаются форматы: .xlsx, .xls
                                    </p>
                                </div>
                            </label>
                        </div>

                        {sheetNames.length > 1 && (
                            <div className="space-y-2">
                                <p className="text-sm text-slate-400">Выберите лист для импорта:</p>
                                <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto">
                                    {sheetNames.map(sheet => (
                                        <Button
                                            key={sheet}
                                            variant={selectedSheet === sheet ? 'primary' : 'outline'}
                                            onClick={() => handleSheetSelect(sheet)}
                                            className="justify-start"
                                        >
                                            <FileSpreadsheet className="w-4 h-4 mr-2" />
                                            {sheet}
                                        </Button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {loading && (
                            <div className="flex items-center justify-center gap-2 text-slate-400">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>Обработка файла...</span>
                            </div>
                        )}
                    </div>
                )}

                {step === 'preview' && (
                    <div className="space-y-4">
                        <div className="bg-emerald-500/10 border border-emerald-500/50 rounded-lg p-4">
                            <p className="text-emerald-400 font-medium">
                                Найдено тех.карт: {parsedData.length}
                            </p>
                            <p className="text-sm text-slate-400 mt-1">
                                Лист: <span className="font-mono">{selectedSheet}</span>
                            </p>
                        </div>

                        <div className="max-h-96 overflow-y-auto">
                            <div className="space-y-3">
                                {parsedData.slice(0, 10).map((techCard, idx) => (
                                    <div key={idx} className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                                <p className="text-slate-200 font-medium">{techCard.gpName}</p>
                                                <p className="text-xs text-slate-400 font-mono mt-1">
                                                    {techCard.gpSku}
                                                </p>
                                                <p className="text-xs text-slate-500 mt-2">
                                                    Материалов: {techCard.ingredients.length}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {parsedData.length > 10 && (
                                    <p className="text-sm text-slate-500 text-center">
                                        ... и еще {parsedData.length - 10} тех.карт
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <Button
                                variant="outline"
                                onClick={() => setStep('upload')}
                                className="flex-1"
                            >
                                Назад
                            </Button>
                            <Button
                                onClick={handleImport}
                                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                            >
                                Импортировать
                            </Button>
                        </div>
                    </div>
                )}

                {step === 'importing' && (
                    <div className="flex flex-col items-center justify-center py-8 space-y-4">
                        <Loader2 className="w-12 h-12 animate-spin text-emerald-500" />
                        <p className="text-slate-300">Импорт тех.карт...</p>
                    </div>
                )}

                {step === 'success' && (
                    <div className="flex flex-col items-center justify-center py-8 space-y-4">
                        <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center">
                            <Check className="w-8 h-8 text-emerald-500" />
                        </div>
                        <div className="text-center">
                            <p className="text-slate-200 font-medium text-lg">
                                Импорт завершен успешно!
                            </p>
                            <p className="text-slate-400 mt-2">
                                Импортировано тех.карт: {importedCount}
                            </p>
                        </div>
                        <Button
                            onClick={onClose}
                            className="bg-emerald-600 hover:bg-emerald-700"
                        >
                            Закрыть
                        </Button>
                    </div>
                )}

                {error && (
                    <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4 flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                            <p className="text-red-400 font-medium">Ошибка</p>
                            <p className="text-sm text-red-300 mt-1">{error}</p>
                        </div>
                        <button
                            onClick={() => setError(null)}
                            className="text-red-400 hover:text-red-300"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                )}
            </div>
        </Modal>
    );
}

