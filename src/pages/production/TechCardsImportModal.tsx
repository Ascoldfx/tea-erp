import { useState, useEffect } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Upload, FileSpreadsheet, Check, AlertTriangle, Loader2, X } from 'lucide-react';
import * as XLSX from 'xlsx';
import { parseTechCardsFromExcel } from '../../services/techCardsExportService';
import type { ImportedTechCard } from '../../services/techCardsExportService';
import { useInventory } from '../../hooks/useInventory';
import type { Recipe, RecipeIngredient } from '../../types/production';
// import { supabase } from '../../lib/supabase';

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

    const [existingRecipes, setExistingRecipes] = useState<Recipe[]>([]);

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

            // Fetch existing recipes to check for duplicates
            const fetchExisting = async () => {
                const recipes = await recipesService.getRecipes();
                setExistingRecipes(recipes);
                console.log(`[Import] Loaded ${recipes.length} existing recipes for de-duplication lookup`);
            };
            fetchExisting();

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
            const foundMaterials: Array<{ sku: string; name: string; foundAs?: string; isMultiple?: boolean }> = [];


            // ВАЖНО: Используем динамический список items, который обновляется после создания материалов
            let currentItems = [...items]; // Копируем текущий список

            for (const techCard of parsedData) {
                // Находим готовую продукцию по SKU или создаем новую
                let finishedGood = currentItems.find(i => i.sku === techCard.gpSku);

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

                // Если не найдено, используем временный ID для объекта Recipe
                // ВАЖНО: При сохранении в БД (в recipesService) null будет преобразован из temp-*
                const outputItemId = finishedGood?.id || `temp-${techCard.gpSku}`; // Используем temp-* для объекта Recipe

                // --- DE-DUPLICATION LOGIC START ---
                // Check if we already have a recipe for this output item (SKU)
                let existingRecipe: Recipe | undefined;

                if (finishedGood) {
                    // Match by Output Item ID
                    existingRecipe = existingRecipes.find(r => r.outputItemId === finishedGood?.id);
                }

                // If not found by ID, try fuzzy match by name or SKU description
                if (!existingRecipe) {
                    existingRecipe = existingRecipes.find(r => {
                        // Check explicit SKU in description
                        if (r.description && r.description.includes(techCard.gpSku)) return true;
                        // Check name match
                        if (r.name.toLowerCase().trim() === techCard.gpName.toLowerCase().trim()) return true;
                        return false;
                    });
                }

                // Reuse ID if found, otherwise create new
                const recipeId = existingRecipe?.id || `rcp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

                if (existingRecipe) {
                    console.log(`[Import] Found existing recipe for SKU ${techCard.gpSku}: updating ID ${recipeId}`);
                }
                // --- DE-DUPLICATION LOGIC END ---

                const ingredients: RecipeIngredient[] = [];

                // ВАЖНО: Обрабатываем ВСЕ ингредиенты из Excel, даже если они не найдены в базе
                console.log(`[Import] Обработка тех.карты "${techCard.gpName}": ${techCard.ingredients.length} ингредиентов из Excel`);

                for (const ing of techCard.ingredients) {
                    const searchSku = ing.materialSku?.trim() || '';
                    const searchName = ing.materialName?.trim() || '';

                    if (!searchSku && !searchName) {
                        console.warn(`[Import] Пропущен ингредиент без SKU и названия для тех.карты "${techCard.gpName}"`);
                        // ВАЖНО: Даже если нет SKU и названия, добавляем с временным ID, если есть норма
                        if (ing.norm > 0) {
                            const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                            ingredients.push({
                                itemId: tempId,
                                quantity: ing.norm,
                                isAutoCreated: true,
                                tempMaterial: { sku: 'UNKNOWN', name: 'Неизвестный материал' },
                                monthlyNorms: ing.monthlyNorms
                            });
                            console.warn(`[Import] Добавлен ингредиент с временным ID (нет SKU/названия): норма=${ing.norm}`);
                        }
                        continue;
                    }

                    //console.log(`[Import] Обработка ингредиента: "${searchSku}" - "${searchName}" (норма: ${ing.norm})`);

                    // Находим ВСЕ материалы по SKU (точное совпадение, без учета регистра)
                    // Это важно, так как один артикул может соответствовать нескольким материалам
                    let matchingMaterials = currentItems.filter(i => {
                        const itemSku = (i.sku || '').trim();
                        return itemSku && itemSku.toLowerCase() === searchSku.toLowerCase();
                    });

                    // Если не найдено по SKU, ищем по названию (точное совпадение, без учета регистра)
                    if (matchingMaterials.length === 0 && searchName) {
                        matchingMaterials = currentItems.filter(i => {
                            const itemName = (i.name || '').trim();
                            return itemName.toLowerCase() === searchName.toLowerCase();
                        });
                    }

                    // Если не найдено, ищем по частичному совпадению названия (более гибко)
                    if (matchingMaterials.length === 0 && searchName) {
                        matchingMaterials = currentItems.filter(i => {
                            const itemName = (i.name || '').trim().toLowerCase();
                            const searchNameLower = searchName.toLowerCase();

                            // Убираем лишние пробелы и сравниваем
                            const normalizedItemName = itemName.replace(/\s+/g, ' ').trim();
                            const normalizedSearchName = searchNameLower.replace(/\s+/g, ' ').trim();

                            // Проверяем, содержит ли одно другое (или наоборот)
                            if (normalizedItemName.includes(normalizedSearchName) ||
                                normalizedSearchName.includes(normalizedItemName)) {
                                return true;
                            }

                            // Проверяем совпадение ключевых слов (если название длинное)
                            if (normalizedSearchName.length > 10) {
                                const searchWords = normalizedSearchName.split(/\s+/).filter(w => w.length > 3);
                                const itemWords = normalizedItemName.split(/\s+/).filter(w => w.length > 3);
                                const matchingWords = searchWords.filter(sw =>
                                    itemWords.some(iw => iw.includes(sw) || sw.includes(iw))
                                );
                                // Если больше половины ключевых слов совпадают
                                if (matchingWords.length >= Math.ceil(searchWords.length / 2)) {
                                    return true;
                                }
                            }

                            return false;
                        });
                    }

                    // Если не найдено, ищем по частичному совпадению SKU
                    if (matchingMaterials.length === 0 && searchSku) {
                        matchingMaterials = currentItems.filter(i => {
                            const itemSku = (i.sku || '').trim().toLowerCase();
                            return itemSku && (
                                itemSku.includes(searchSku.toLowerCase()) ||
                                searchSku.toLowerCase().includes(itemSku)
                            );
                        });
                    }

                    // Если материалы найдены, добавляем их все (один артикул может соответствовать нескольким материалам)
                    if (matchingMaterials.length > 0) {
                        // Если найдено несколько материалов с одинаковым артикулом - это нужно отметить
                        if (matchingMaterials.length > 1) {
                            console.warn(`[Import] ⚠️ Найдено ${matchingMaterials.length} материалов с артикулом "${searchSku}":`,
                                matchingMaterials.map(m => `${m.sku} - ${m.name}`)
                            );
                        }

                        // Добавляем все найденные материалы в техкарту
                        matchingMaterials.forEach(material => {
                            ingredients.push({
                                itemId: material.id,
                                quantity: ing.norm,
                                // Добавляем флаг, если это один из нескольких материалов с одинаковым артикулом
                                isDuplicateSku: matchingMaterials.length > 1,
                                // Сохраняем нормы по месяцам, если они есть
                                monthlyNorms: ing.monthlyNorms,
                                // ВАЖНО: Сохраняем tempMaterial с оригинальным названием из Excel для правильного отображения
                                tempMaterial: {
                                    sku: ing.materialSku || material.sku || '',
                                    name: ing.materialName || material.name || 'Неизвестный материал',
                                    unit: ing.unit
                                }
                            });
                            foundMaterials.push({
                                sku: ing.materialSku,
                                name: ing.materialName,
                                foundAs: `${material.sku} - ${material.name}`,
                                isMultiple: matchingMaterials.length > 1
                            });
                        });

                        // console.log(`[Import] Материал найден: "${ing.materialSku}" - "${ing.materialName}" → ${matchingMaterials.length} материал(ов)`);
                    } else {
                        // Материал не найден - ВАЖНО: больше НЕ создаем его
                        // Просто добавляем как "текстовый" ингредиент с временным ID

                        const tempId = `temp-${searchSku}`;
                        ingredients.push({
                            itemId: tempId,
                            quantity: ing.norm,
                            isAutoCreated: true,
                            tempMaterial: { sku: searchSku, name: searchName, unit: ing.unit },
                            // Сохраняем нормы по месяцам, если они есть
                            monthlyNorms: ing.monthlyNorms
                        });
                        missingMaterials.push({ sku: ing.materialSku, name: ing.materialName });
                        // console.warn(`[Import] Материал не найден, добавлен как текст: "${searchSku}" - "${searchName}"`);
                    }
                }

                // ВАЖНО: Создаем тех.карту со ВСЕМИ ингредиентами из импортируемого документа

                if (ingredients.length > 0) {
                    recipes.push({
                        id: recipeId, // Reused ID or New ID
                        name: techCard.gpName,
                        description: `Артикул: ${techCard.gpSku}`,
                        outputItemId,
                        outputQuantity: 1,
                        ingredients
                    });
                } else {
                    console.warn(`[Import] ⚠️ Тех.карта "${techCard.gpName}" не создана: не найдено ни одного материала из ${techCard.ingredients.length} в Excel`);
                }
            }

            // Логируем статистику
            console.log(`[Import] === СТАТИСТИКА ИМПОРТА ТЕХ.КАРТ ===`);
            console.log(`[Import] Всего тех.карт обработано: ${parsedData.length}`);
            console.log(`[Import] Тех.карт создано: ${recipes.length}`);
            console.log(`[Import] Найдено материалов: ${foundMaterials.length}, не найдено (добавлено текстом): ${missingMaterials.length}`);

            if (foundMaterials.length > 0) {
                console.log('[Import] Найденные материалы (примеры):', foundMaterials.slice(0, 5));
            }

            if (missingMaterials.length > 0) {
                const uniqueMissing = Array.from(
                    new Map(missingMaterials.map(m => [m.sku + m.name, m])).values()
                );
                console.warn('[Import] === МАТЕРИАЛЫ БЕЗ СВЯЗЕЙ В БАЗЕ ===');
                console.warn(`[Import] Эти материалы сохранены только внутри рецептов: ${uniqueMissing.length} шт.`);
                // console.warn('[Import] Пример:', uniqueMissing.slice(0, 5));
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
                                                <div className="flex justify-between items-start">
                                                    <p className="text-slate-200 font-medium">{techCard.gpName}</p>
                                                    <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">
                                                        {techCard.ingredients.length} мат.
                                                    </span>
                                                </div>
                                                <p className="text-xs text-slate-400 font-mono mt-1">
                                                    {techCard.gpSku}
                                                </p>

                                                {/* Zero Norm Warning - Only if ALL ingredients are zero (empty recipe) */}
                                                {techCard.ingredients.every(i => i.norm === 0) && (
                                                    <div className="mt-2 text-xs text-red-400 bg-red-500/10 p-2 rounded border border-red-500/20">
                                                        🔴 Внимание: Все материалы имеют нулевую норму.
                                                        <div className="mt-1 opacity-80">
                                                            Техкарта не будет работать корректно без норм. Проверьте файл.
                                                        </div>
                                                    </div>
                                                )}
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

