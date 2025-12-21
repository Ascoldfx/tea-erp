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

            const missingMaterials: Array<{ sku: string; name: string }> = [];
            const foundMaterials: Array<{ sku: string; name: string }> = [];

            for (const techCard of parsedData) {
                // Находим готовую продукцию по SKU или создаем новую
                let finishedGood = items.find(i => i.sku === techCard.gpSku);
                
                // Если не найдено по SKU, ищем по названию (точное совпадение)
                if (!finishedGood) {
                    finishedGood = items.find(i => 
                        i.name.toLowerCase().trim() === techCard.gpName.toLowerCase().trim()
                    );
                }

                // Если не найдено, ищем по частичному совпадению названия
                if (!finishedGood) {
                    finishedGood = items.find(i => 
                        i.name.toLowerCase().includes(techCard.gpName.toLowerCase()) ||
                        techCard.gpName.toLowerCase().includes(i.name.toLowerCase())
                    );
                }

                // Если не найдено, создаем временный ID
                const outputItemId = finishedGood?.id || `temp-${techCard.gpSku}`;

                const ingredients: RecipeIngredient[] = [];

                for (const ing of techCard.ingredients) {
                    // Находим материал по SKU (точное совпадение)
                    let material = items.find(i => i.sku && i.sku.trim() === ing.materialSku.trim());
                    
                    // Если не найдено по SKU, ищем по названию (точное совпадение)
                    if (!material) {
                        material = items.find(i => 
                            i.name.toLowerCase().trim() === ing.materialName.toLowerCase().trim()
                        );
                    }

                    // Если не найдено, ищем по частичному совпадению названия
                    if (!material) {
                        material = items.find(i => {
                            const itemNameLower = i.name.toLowerCase();
                            const searchNameLower = ing.materialName.toLowerCase();
                            return itemNameLower.includes(searchNameLower) ||
                                   searchNameLower.includes(itemNameLower);
                        });
                    }

                    // Если не найдено, ищем по частичному совпадению SKU
                    if (!material && ing.materialSku) {
                        material = items.find(i => 
                            i.sku && i.sku.toLowerCase().includes(ing.materialSku.toLowerCase())
                        );
                    }

                    if (material) {
                        ingredients.push({
                            itemId: material.id,
                            quantity: ing.norm
                        });
                        foundMaterials.push({ sku: ing.materialSku, name: ing.materialName });
                    } else {
                        missingMaterials.push({ sku: ing.materialSku, name: ing.materialName });
                        console.warn(`Материал не найден: ${ing.materialSku} - ${ing.materialName}`);
                    }
                }

                // Создаем тех.карту, даже если не все материалы найдены (но хотя бы один должен быть)
                if (ingredients.length > 0) {
                    recipes.push({
                        id: `rcp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                        name: techCard.gpName,
                        description: `Артикул: ${techCard.gpSku}`,
                        outputItemId,
                        outputQuantity: 1,
                        ingredients
                    });
                } else {
                    console.warn(`Тех.карта "${techCard.gpName}" не создана: не найдено ни одного материала`);
                }
            }

            // Логируем статистику
            console.log(`[Import] Найдено материалов: ${foundMaterials.length}, не найдено: ${missingMaterials.length}`);
            if (missingMaterials.length > 0) {
                console.log('[Import] Не найденные материалы:', missingMaterials.slice(0, 10));
            }

            setImportedCount(recipes.length);
            
            // Показываем предупреждение, если есть не найденные материалы
            if (missingMaterials.length > 0) {
                const missingCount = missingMaterials.length;
                const uniqueMissing = Array.from(
                    new Map(missingMaterials.map(m => [m.sku + m.name, m])).values()
                );
                console.warn(`[Import] Не найдено ${missingCount} материалов. Уникальных: ${uniqueMissing.length}`);
                
                // Показываем предупреждение в UI, но не блокируем импорт
                if (recipes.length === 0) {
                    setError(
                        `Не удалось импортировать тех.карты: не найдено материалов в базе данных.\n\n` +
                        `Не найдено материалов: ${uniqueMissing.length}\n` +
                        `Примеры: ${uniqueMissing.slice(0, 5).map(m => `${m.sku} - ${m.name}`).join(', ')}`
                    );
                    setStep('preview');
                    return;
                } else {
                    // Если хотя бы некоторые тех.карты импортированы, показываем предупреждение, но продолжаем
                    console.warn(`[Import] Импортировано ${recipes.length} тех.карт, но ${uniqueMissing.length} материалов не найдено`);
                }
            }
            
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
                                {importedCount > 0 ? 'Импорт завершен успешно!' : 'Импорт завершен, но тех.карты не созданы'}
                            </p>
                            <p className="text-slate-400 mt-2">
                                Импортировано тех.карт: {importedCount}
                            </p>
                            {importedCount === 0 && (
                                <p className="text-sm text-yellow-400 mt-2">
                                    Проверьте консоль (F12) для списка не найденных материалов
                                </p>
                            )}
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

