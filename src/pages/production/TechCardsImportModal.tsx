import { useState, useEffect } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Upload, FileSpreadsheet, Check, AlertTriangle, Loader2, X } from 'lucide-react';
import * as XLSX from 'xlsx';
import { parseTechCardsFromExcel } from '../../services/techCardsExportService';
import type { ImportedTechCard } from '../../services/techCardsExportService';
import { useInventory } from '../../hooks/useInventory';
import type { Recipe, RecipeIngredient } from '../../types/production';
import { supabase } from '../../lib/supabase';

interface TechCardsImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onImport: (recipes: Recipe[]) => void;
}

export default function TechCardsImportModal({ isOpen, onClose, onImport }: TechCardsImportModalProps) {
    const { items, refresh: refreshInventory } = useInventory();
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
            const foundMaterials: Array<{ sku: string; name: string; foundAs?: string; isMultiple?: boolean }> = [];
            let materialsCreatedCount = 0;
            
            // Функция для определения категории по группе КСМ
            const mapCategory = (group: string): string => {
                const groupLower = (group || '').toLowerCase().trim();
                if (groupLower.includes('сировина') || groupLower.includes('сырье')) return 'tea_bulk';
                if (groupLower.includes('суміш') || groupLower.includes('смесь')) return 'tea_bulk';
                if (groupLower.includes('картон') || groupLower.includes('упаковка')) return 'packaging_cardboard';
                if (groupLower.includes('ярлик') || groupLower.includes('этикетка') || groupLower.includes('label')) return 'label';
                if (groupLower.includes('г/я') || groupLower.includes('гофро') || groupLower.includes('ящик')) return 'packaging_crate';
                return 'other';
            };

            // Функция для создания материала в базе данных
            const createMaterial = async (sku: string, name: string, category: string, unit: string): Promise<string | null> => {
                if (!supabase || !sku) return null;
                
                try {
                    // Используем SKU как ID
                    const itemId = sku.trim();
                    const normalizedUnit = unit.toLowerCase() === 'pcs' || unit === 'шт' ? 'pcs' : 
                                          unit.toLowerCase() === 'kg' || unit === 'кг' ? 'kg' : 
                                          unit.toLowerCase() === 'g' || unit === 'г' ? 'g' : 'pcs';
                    
                    const { data, error } = await supabase
                        .from('items')
                        .upsert({
                            id: itemId,
                            sku: sku.trim(),
                            name: name.trim(),
                            category: category,
                            unit: normalizedUnit,
                            min_stock_level: 0
                        }, {
                            onConflict: 'id'
                        })
                        .select('id')
                        .single();
                    
                    if (error) {
                        console.error(`[Import] Ошибка при создании материала ${sku}:`, error);
                        return null;
                    }
                    
                    console.log(`[Import] Материал создан: ${sku} - ${name} (категория: ${category})`);
                    return data?.id || itemId;
                } catch (e) {
                    console.error(`[Import] Исключение при создании материала ${sku}:`, e);
                    return null;
                }
            };

            // ВАЖНО: Используем динамический список items, который обновляется после создания материалов
            let currentItems = [...items]; // Копируем текущий список
            
            // Список созданных материалов для последующего обновления items (если нужно)
            // const createdMaterials: Array<{ sku: string; name: string; category: string; unit: string }> = [];
            
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
                    
                    console.log(`[Import] Обработка ингредиента: "${searchSku}" - "${searchName}" (норма: ${ing.norm})`);
                    
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
                                    name: ing.materialName || material.name || 'Неизвестный материал' 
                                }
                            });
                            foundMaterials.push({ 
                                sku: ing.materialSku, 
                                name: ing.materialName,
                                foundAs: `${material.sku} - ${material.name}`,
                                isMultiple: matchingMaterials.length > 1
                            });
                        });
                        
                        console.log(`[Import] Материал найден: "${ing.materialSku}" - "${ing.materialName}" → ${matchingMaterials.length} материал(ов)`);
                    } else {
                        // Материал не найден - создаем его автоматически
                        const category = mapCategory(ing.materialCategory || '');
                        const unit = ing.unit || 'pcs';
                        
                        // Создаем материал сразу
                        const createdId = await createMaterial(searchSku, searchName, category, unit);
                        
                        if (createdId) {
                            // Добавляем созданный материал в техкарту
                            // ВАЖНО: Сохраняем tempMaterial даже для созданных материалов, чтобы название было доступно
                            ingredients.push({
                                itemId: createdId,
                                quantity: ing.norm,
                                isAutoCreated: true,
                                // Сохраняем нормы по месяцам, если они есть
                                monthlyNorms: ing.monthlyNorms,
                                // Сохраняем tempMaterial для отображения названия
                                tempMaterial: { sku: searchSku, name: searchName }
                            });
                            foundMaterials.push({ 
                                sku: ing.materialSku, 
                                name: ing.materialName,
                                foundAs: `[СОЗДАН] ${searchSku} - ${searchName}`
                            });
                            materialsCreatedCount++;
                            console.log(`[Import] Материал создан и добавлен: "${searchSku}" - "${searchName}"`);
                            
                            // ВАЖНО: Добавляем созданный материал в currentItems для использования в следующих техкартах
                            const normalizedUnit = unit.toLowerCase() === 'pcs' || unit === 'шт' ? 'pcs' : 
                                                  unit.toLowerCase() === 'kg' || unit === 'кг' ? 'kg' : 
                                                  unit.toLowerCase() === 'g' || unit === 'г' ? 'g' : 'pcs';
                            currentItems.push({
                                id: createdId,
                                sku: searchSku,
                                name: searchName,
                                category: category,
                                unit: normalizedUnit,
                                minStockLevel: 0
                            } as any);
                        } else {
                            // Если не удалось создать, все равно добавляем с временным ID
                            const tempId = `temp-${searchSku}`;
                            ingredients.push({
                                itemId: tempId,
                                quantity: ing.norm,
                                isAutoCreated: true,
                                tempMaterial: { sku: searchSku, name: searchName },
                                // Сохраняем нормы по месяцам, если они есть
                                monthlyNorms: ing.monthlyNorms
                            });
                            missingMaterials.push({ sku: ing.materialSku, name: ing.materialName });
                            console.warn(`[Import] Материал создан с временным ID: "${searchSku}" - "${searchName}"`);
                        }
                    }
                }

                // ВАЖНО: Создаем тех.карту со ВСЕМИ ингредиентами из импортируемого документа
                // Приоритет - импортируемый документ, все материалы должны быть включены
                // Даже если некоторые материалы не найдены, они добавляются с временным ID
                console.log(`[Import] === ИТОГИ ОБРАБОТКИ ТЕХ.КАРТЫ "${techCard.gpName}" ===`);
                console.log(`[Import] Ингредиентов в Excel: ${techCard.ingredients.length}`);
                console.log(`[Import] Ингредиентов добавлено в техкарту: ${ingredients.length}`);
                console.log(`[Import] Детали ингредиентов из Excel:`, techCard.ingredients.map((ing, idx) => 
                    `${idx + 1}. ${ing.materialSku || 'NO SKU'} - ${ing.materialName || 'NO NAME'} (норма: ${ing.norm})`
                ));
                
                if (ingredients.length !== techCard.ingredients.length) {
                    const missing = techCard.ingredients.filter((ing) => {
                        // Проверяем, был ли этот ингредиент добавлен
                        const wasAdded = ingredients.some(added => {
                            const addedSku = added.tempMaterial?.sku || currentItems.find(i => i.id === added.itemId)?.sku;
                            const addedName = added.tempMaterial?.name || currentItems.find(i => i.id === added.itemId)?.name;
                            return (addedSku && addedSku === ing.materialSku) || 
                                   (addedName && addedName === ing.materialName) ||
                                   added.itemId === `temp-${ing.materialSku}`;
                        });
                        return !wasAdded;
                    });
                    
                    console.warn(`[Import] ⚠️ НЕ ВСЕ ИНГРЕДИЕНТЫ ДОБАВЛЕНЫ!`);
                    console.warn(`[Import] Пропущено ингредиентов: ${missing.length}`);
                    console.warn(`[Import] Пропущенные ингредиенты:`, missing.map(ing => 
                        `"${ing.materialSku || 'NO SKU'}" - "${ing.materialName || 'NO NAME'}" (норма: ${ing.norm})`
                    ).join(', '));
                    
                    // ВАЖНО: Добавляем пропущенные ингредиенты с временным ID
                    for (const missingIng of missing) {
                        const tempId = `temp-${missingIng.materialSku || Date.now()}`;
                        ingredients.push({
                            itemId: tempId,
                            quantity: missingIng.norm || 0,
                            isAutoCreated: true,
                            tempMaterial: { 
                                sku: missingIng.materialSku || 'UNKNOWN', 
                                name: missingIng.materialName || 'Неизвестный материал' 
                            }
                        });
                        console.log(`[Import] Добавлен пропущенный ингредиент с временным ID: "${missingIng.materialSku}" - "${missingIng.materialName}"`);
                    }
                    
                    console.log(`[Import] После добавления пропущенных: ${ingredients.length} ингредиентов в техкарте`);
                }
                
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
                    console.warn(`[Import] ⚠️ Тех.карта "${techCard.gpName}" не создана: не найдено ни одного материала из ${techCard.ingredients.length} в Excel`);
                }
            }

            // Обновляем список материалов после создания новых
            // Это нужно для того, чтобы созданные материалы были доступны при поиске в следующих техкартах
            if (materialsCreatedCount > 0) {
                console.log(`[Import] Обновляем список материалов после создания ${materialsCreatedCount} новых...`);
                await refreshInventory();
                console.log(`[Import] Список материалов обновлен`);
                
                // Перезагружаем items из useInventory после обновления
                // Но это не сработает в этой функции, так как items - это состояние из хука
                // Поэтому мы обновим items через refresh, и в следующей итерации цикла они будут доступны
                // Но для первой техкарты это не поможет, поэтому нужно обрабатывать техкарты в два прохода
            }
            
            // Логируем статистику
            console.log(`[Import] === СТАТИСТИКА ИМПОРТА ТЕХ.КАРТ ===`);
            console.log(`[Import] Всего тех.карт обработано: ${parsedData.length}`);
            console.log(`[Import] Тех.карт создано: ${recipes.length}`);
            console.log(`[Import] Найдено материалов: ${foundMaterials.length}, создано новых: ${materialsCreatedCount}, не найдено: ${missingMaterials.length}`);
            
            if (foundMaterials.length > 0) {
                console.log('[Import] Найденные материалы:', foundMaterials.slice(0, 10));
            }
            
            if (missingMaterials.length > 0) {
                const uniqueMissing = Array.from(
                    new Map(missingMaterials.map(m => [m.sku + m.name, m])).values()
                );
                console.warn('[Import] === НЕ НАЙДЕННЫЕ МАТЕРИАЛЫ ===');
                console.warn(`[Import] Всего не найдено: ${missingMaterials.length}, уникальных: ${uniqueMissing.length}`);
                console.warn('[Import] Список не найденных материалов:', uniqueMissing);
                
                // Показываем примеры похожих материалов из базы для каждого не найденного
                uniqueMissing.slice(0, 5).forEach(missing => {
                    const similar = items.filter(i => {
                        const itemName = (i.name || '').toLowerCase();
                        const itemSku = (i.sku || '').toLowerCase();
                        const searchName = (missing.name || '').toLowerCase();
                        const searchSku = (missing.sku || '').toLowerCase();
                        
                        return itemName.includes(searchName.substring(0, 10)) ||
                               searchName.includes(itemName.substring(0, 10)) ||
                               itemSku.includes(searchSku.substring(0, 5)) ||
                               searchSku.includes(itemSku.substring(0, 5));
                    }).slice(0, 3);
                    
                    if (similar.length > 0) {
                        console.warn(`[Import] Похожие материалы для "${missing.sku} - ${missing.name}":`, 
                            similar.map(s => `${s.sku} - ${s.name}`)
                        );
                    }
                });
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
                    
                    // Показываем предупреждение в UI с детальной информацией
                    const warningMessage = 
                        `Импортировано ${recipes.length} тех.карт.\n\n` +
                        `⚠️ Не найдено материалов: ${uniqueMissing.length}\n\n` +
                        `Не найденные материалы:\n${uniqueMissing.slice(0, 10).map((m, idx) => 
                            `${idx + 1}. ${m.sku} - ${m.name}`
                        ).join('\n')}` +
                        (uniqueMissing.length > 10 ? `\n... и еще ${uniqueMissing.length - 10} материалов` : '') +
                        `\n\nЭти материалы нужно добавить в базу данных через импорт материалов, ` +
                        `иначе тех.карты будут неполными.`;
                    
                    // Показываем предупреждение, но не блокируем импорт
                    alert(warningMessage);
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

