import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Search, Plus, FileText, Download, Upload, Hash, Star, RefreshCw } from 'lucide-react';
// MOCK_RECIPES больше не используется - все техкарты загружаются из базы данных или импортируются
import { useNavigate } from 'react-router-dom';
import { useInventory } from '../../hooks/useInventory';
import { exportTechCardsToExcel } from '../../services/techCardsExportService';
import TechCardsImportModal from './TechCardsImportModal';
import RecipeDetailsModal from './RecipeDetailsModal';
import { TOP_25_SKUS } from '../../data/top25Skus';
import { recipesService } from '../../services/recipesService';
import type { Recipe } from '../../types/production';

export default function TechCardsList() {
    const [searchTerm, setSearchTerm] = useState('');
    const [recipes, setRecipes] = useState<Recipe[]>([]);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
    const navigate = useNavigate();
    const { items, plannedConsumption } = useInventory();

    // Инициализируем тех.карты из localStorage
    // MOCK_RECIPES очищен - все техкарты загружаются из localStorage или импортируются
    // Загружаем техкарты из базы данных при монтировании компонента
    // Техкарты хранятся стабильно в базе данных и не требуют периодической перезагрузки
    useEffect(() => {
        const loadRecipes = async () => {
            try {
                const loadedRecipes = await recipesService.getRecipes();
                console.log(`[TechCardsList] Загружено ${loadedRecipes.length} тех.карт из базы данных`);
                if (loadedRecipes.length > 0) {
                    setRecipes(loadedRecipes);
                } else {
                    console.warn('[TechCardsList] База данных пуста - техкарты не найдены');
                }
            } catch (error) {
                console.error('[TechCardsList] Ошибка при загрузке тех.карт:', error);
                // Не очищаем список при ошибке, оставляем существующие техкарты
            }
        };

        loadRecipes();
    }, []);

    // Проверка, является ли техкарта приоритетной (топ-25)
    const isPriorityRecipe = useMemo(() => {
        return (recipe: Recipe): boolean => {
            // Сначала пытаемся найти готовый продукт по outputItemId
            const finishedGood = items.find(i => i.id === recipe.outputItemId);
            let sku = finishedGood?.sku || '';
            
            // Если не нашли по ID, извлекаем SKU из description
            // Формат: "Артикул: 282157"
            if (!sku && recipe.description) {
                const skuMatch = recipe.description.match(/Артикул:\s*(\d+)/i);
                if (skuMatch) {
                    sku = skuMatch[1];
                }
            }
            
            // Если outputItemId начинается с "temp-", извлекаем SKU оттуда
            if (!sku && recipe.outputItemId && recipe.outputItemId.startsWith('temp-')) {
                sku = recipe.outputItemId.replace(/^temp-/, '');
            }
            
            // Проверяем, есть ли этот SKU в топ-25
            const isPriority = Boolean(sku && TOP_25_SKUS.includes(sku));
            
            // Логирование для отладки
            if (isPriority) {
                console.log(`[Priority] Recipe "${recipe.name}" is priority (SKU: ${sku})`);
            }
            
            return isPriority;
        };
    }, [items]);

    // Сортировка и фильтрация техкарт
    const filteredAndSortedRecipes = useMemo(() => {
        const filtered = recipes.filter(r =>
            r.name.toLowerCase().includes(searchTerm.toLowerCase())
        );

        // Сортируем: приоритетные сверху, затем остальные
        return filtered.sort((a, b) => {
            const aIsPriority = isPriorityRecipe(a);
            const bIsPriority = isPriorityRecipe(b);
            
            if (aIsPriority && !bIsPriority) return -1;
            if (!aIsPriority && bIsPriority) return 1;
            return 0; // Сохраняем исходный порядок для одинакового приоритета
        });
    }, [recipes, searchTerm, isPriorityRecipe]);

    const getItemName = (id: string) => items.find(i => i.id === id)?.name || id;
    const getItemUnit = (id: string) => {
        const unit = items.find(i => i.id === id)?.unit || '';
        return unit === 'pcs' ? 'шт' : unit;
    };

    // Парсинг количества пачек в ящике из названия (формат: название (число))
    const parsePacksPerBox = (name: string): number | null => {
        const match = name.match(/\((\d+)\)\s*$/);
        return match ? parseInt(match[1]) : null;
    };

    // Форматирование названия с выделением количества пачек в ящике
    const formatItemName = (name: string): { displayName: string; packsPerBox: number | null } => {
        const packsPerBox = parsePacksPerBox(name);
        if (packsPerBox) {
            // Убираем (число) из конца названия для отображения
            const baseName = name.replace(/\s*\(\d+\)\s*$/, '');
            return { displayName: baseName, packsPerBox };
        }
        return { displayName: name, packsPerBox: null };
    };

    const handleCardDoubleClick = (recipe: Recipe) => {
        setSelectedRecipe(recipe);
        setIsDetailsModalOpen(true);
    };

    const handleExport = async () => {
        try {
            await exportTechCardsToExcel(recipes, items, plannedConsumption);
        } catch (error) {
            console.error('Ошибка при экспорте:', error);
            alert('Ошибка при экспорте техкарт');
        }
    };

    const handleImport = async (importedRecipes: Recipe[]) => {
        // Логируем детали импортированных тех.карт
        console.log('[TechCardsList] === ИМПОРТ ТЕХ.КАРТ ===');
        console.log(`[TechCardsList] Импортировано тех.карт: ${importedRecipes.length}`);
        importedRecipes.forEach((recipe) => {
            console.log(`[TechCardsList] Тех.карта: "${recipe.name}" (ID: ${recipe.id})`);
            console.log(`[TechCardsList]   - Ингредиентов: ${recipe.ingredients.length}`);
        });
        
        // ВАЖНО: Сохраняем в базу данных ПЕРЕД обновлением списка
        try {
            console.log('[TechCardsList] Начинаем сохранение тех.карт в базу данных...');
            const savedCount = await recipesService.saveRecipes(importedRecipes);
            console.log(`[TechCardsList] ✅ Сохранено ${savedCount} из ${importedRecipes.length} тех.карт в базу данных`);
            
            if (savedCount !== importedRecipes.length) {
                console.warn(`[TechCardsList] ⚠️ Не все тех.карты сохранены! Ожидалось: ${importedRecipes.length}, сохранено: ${savedCount}`);
            }
            
            // ВАЖНО: Всегда перезагружаем список из базы данных после сохранения
            // Это гарантирует, что мы видим актуальные данные
            console.log('[TechCardsList] Перезагружаем список тех.карт из базы данных...');
            const loadedRecipes = await recipesService.getRecipes();
            console.log(`[TechCardsList] ✅ Загружено ${loadedRecipes.length} тех.карт из базы данных`);
            
            if (loadedRecipes.length === 0) {
                console.error('[TechCardsList] ❌ КРИТИЧЕСКАЯ ОШИБКА: После сохранения база данных пуста!');
                // Оставляем импортированные техкарты в локальном состоянии
                setRecipes(prev => {
                    const combined = [...prev, ...importedRecipes];
                    // Убираем дубликаты по ID
                    const unique = Array.from(new Map(combined.map(r => [r.id, r])).values());
                    return unique;
                });
            } else {
                setRecipes(loadedRecipes);
            }
        } catch (error) {
            console.error('[TechCardsList] ❌ Ошибка при сохранении тех.карт в базу данных:', error);
            // В случае ошибки добавляем техкарты в локальный список
            // Но это временное решение - техкарты могут пропасть при обновлении страницы
            setRecipes(prev => {
                const combined = [...prev, ...importedRecipes];
                // Убираем дубликаты по ID
                const unique = Array.from(new Map(combined.map(r => [r.id, r])).values());
                return unique;
            });
            alert('Ошибка при сохранении тех.карт в базу данных. Проверьте консоль для деталей.');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-slate-100">Технологические Карты</h1>
                    <p className="text-slate-400 mt-1">Рецептуры и нормы расхода (на 1 ящик)</p>
                </div>
                <div className="flex gap-3">
                    <Button 
                        variant="outline" 
                        onClick={handleExport}
                        className="border-slate-600 hover:bg-slate-800"
                    >
                        <Download className="w-4 h-4 mr-2" />
                        Экспорт в Excel
                    </Button>
                    <Button 
                        variant="outline" 
                        onClick={() => setIsImportModalOpen(true)}
                        className="border-slate-600 hover:bg-slate-800"
                    >
                        <Upload className="w-4 h-4 mr-2" />
                        Импорт из Excel
                    </Button>
                    <Button onClick={() => navigate('/production/recipes/new')}>
                        <Plus className="w-4 h-4 mr-2" />
                        Создать карту
                    </Button>
                </div>
            </div>

            <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500 w-4 h-4" />
                <Input
                    placeholder="Поиск рецепта..."
                    className="pl-10"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            {filteredAndSortedRecipes.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                    <FileText className="w-12 h-12 mx-auto mb-4 opacity-20" />
                    <p>Нет техкарт. Создайте первую техкарту.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {filteredAndSortedRecipes.map(recipe => {
                        const { displayName, packsPerBox } = formatItemName(recipe.name);
                        const finishedGood = items.find(i => i.id === recipe.outputItemId);
                        const sku = finishedGood?.sku || '';
                        const isPriority = isPriorityRecipe(recipe);
                        
                        return (
                            <Card 
                                key={recipe.id} 
                                className={`transition-colors cursor-pointer ${
                                    isPriority 
                                        ? 'border-2 border-amber-500/50 bg-gradient-to-br from-amber-950/20 to-slate-900 hover:border-amber-500 hover:from-amber-950/30' 
                                        : 'hover:border-emerald-500/50'
                                }`}
                                onDoubleClick={() => handleCardDoubleClick(recipe)}
                            >
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-lg font-bold text-slate-100 flex items-center gap-2 flex-wrap">
                                        {isPriority && (
                                            <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
                                        )}
                                        <FileText className={`w-5 h-5 ${isPriority ? 'text-amber-500' : 'text-emerald-500'}`} />
                                        <span>{displayName}</span>
                                        {packsPerBox && (
                                            <span className="text-emerald-400 font-normal text-base">
                                                ({packsPerBox})
                                            </span>
                                        )}
                                        {isPriority && (
                                            <span className="ml-auto px-2 py-1 text-xs font-semibold bg-amber-500/20 text-amber-400 rounded border border-amber-500/30">
                                                ТОП-25
                                            </span>
                                        )}
                                    </CardTitle>
                                    {sku && (
                                        <div className="flex items-center gap-2 mt-2 text-sm text-slate-400">
                                            <Hash className="w-4 h-4" />
                                            <span className="font-mono">{sku}</span>
                                        </div>
                                    )}
                                </CardHeader>
                                <CardContent>
                                    {recipe.description && (
                                        <p className="text-sm text-slate-400 mb-4">{recipe.description}</p>
                                    )}

                                    <div className="bg-slate-950/50 rounded-lg p-3">
                                        <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2">
                                            Ингредиенты ({recipe.ingredients.length}):
                                        </h4>
                                        <ul className="space-y-1 text-sm max-h-60 overflow-y-auto">
                                            {recipe.ingredients.map((ing, idx) => {
                                                const materialSku = items.find(i => i.id === ing.itemId)?.sku || '';
                                                const isDuplicate = ing.isDuplicateSku;
                                                const isAutoCreated = ing.isAutoCreated;
                                                const tempMaterial = ing.tempMaterial;
                                                
                                                // Определяем, есть ли другие ингредиенты с таким же SKU
                                                const sameSkuCount = recipe.ingredients.filter(otherIng => {
                                                    const otherSku = items.find(i => i.id === otherIng.itemId)?.sku || '';
                                                    return otherSku && otherSku === materialSku && otherIng !== ing;
                                                }).length;
                                                
                                                return (
                                                    <li 
                                                        key={idx} 
                                                        className={`flex justify-between text-slate-300 ${
                                                            (isDuplicate || sameSkuCount > 0) ? 'text-yellow-400' : ''
                                                        } ${
                                                            isAutoCreated ? 'text-blue-400' : ''
                                                        }`}
                                                    >
                                                        <span className="flex items-center gap-2">
                                                            {tempMaterial ? (
                                                                <span className="italic text-slate-500">
                                                                    {tempMaterial.name}
                                                                </span>
                                                            ) : (
                                                                <span>{getItemName(ing.itemId)}</span>
                                                            )}
                                                            {(isDuplicate || sameSkuCount > 0) && (
                                                                <span className="text-xs bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded">
                                                                    {sameSkuCount + 1}
                                                                </span>
                                                            )}
                                                            {isAutoCreated && (
                                                                <span className="text-xs bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded">
                                                                    нов
                                                                </span>
                                                            )}
                                                        </span>
                                                        <span className="text-slate-500">
                                                            {ing.quantity} {tempMaterial ? '-' : getItemUnit(ing.itemId)}
                                                        </span>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    </div>
                                    <p className="text-xs text-slate-500 mt-3 italic text-center">
                                        Двойной клик для просмотра деталей
                                    </p>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}

            <TechCardsImportModal
                isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
                onImport={handleImport}
            />

            <RecipeDetailsModal
                recipe={selectedRecipe}
                isOpen={isDetailsModalOpen}
                onClose={() => {
                    setIsDetailsModalOpen(false);
                    setSelectedRecipe(null);
                }}
            />
        </div>
    );
}
