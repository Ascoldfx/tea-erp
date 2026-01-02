import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Select } from '../../components/ui/Select';
import { Input } from '../../components/ui/Input';

import { Calculator, TrendingUp, CalendarClock, Loader2, Star, AlertCircle } from 'lucide-react';
import { clsx } from 'clsx';
import { useInventory } from '../../hooks/useInventory';
import { recipesService } from '../../services/recipesService';
import type { Recipe, RecipeIngredient } from '../../types/production';
import { TOP_25_SKUS } from '../../data/top25Skus';

export default function ProductionCalculator() {
    const [mode, setMode] = useState<'analyze' | 'plan'>('analyze');
    const [selectedRecipeId, setSelectedRecipeId] = useState<string>('');
    const [targetQuantity, setTargetQuantity] = useState<number>(0);
    const [recipes, setRecipes] = useState<Recipe[]>([]);
    const [loadingRecipes, setLoadingRecipes] = useState(false);

    // Data from Inventory
    const { items, stock, loading: loadingInventory } = useInventory();

    // Debug: Check if stock is loaded correctly
    useEffect(() => {
        if (!loadingInventory && stock.length > 0) {
            console.log(`[Calc Debug] Loaded ${stock.length} stock entries.`);
            // console.log('[Calc Debug] Sample stock:', stock.slice(0, 3));
        } else if (!loadingInventory && stock.length === 0) {
            console.warn('[Calc Debug] Stock array is empty! Check useInventory or API.');
        }
    }, [stock, loadingInventory]);

    // Load Recipes
    useEffect(() => {
        const loadRecipes = async () => {
            setLoadingRecipes(true);
            try {
                const data = await recipesService.getRecipes();
                setRecipes(data);
            } catch (error) {
                console.error("Failed to load recipes", error);
            } finally {
                setLoadingRecipes(false);
            }
        };
        loadRecipes();
    }, []);

    // --- Helper: Check Priority (Top 25) ---
    const isPriorityRecipe = (recipe: Recipe): boolean => {
        // Try to find SKU in items or description
        let sku = '';
        const finishedGood = items.find(i => i.id === recipe.outputItemId);
        if (finishedGood) sku = finishedGood.sku;

        if (!sku && recipe.description) {
            const skuMatch = recipe.description.match(/Артикул:\s*(\d+)/i);
            if (skuMatch) sku = skuMatch[1];
            else {
                const directMatch = recipe.description.match(/^(\d+)/);
                if (directMatch) sku = directMatch[1];
            }
        }

        // Fallback: Check if outputItemId IS the SKU (digits only) or temp-SKU
        if (!sku && recipe.outputItemId) {
            if (recipe.outputItemId.startsWith('temp-')) {
                const part = recipe.outputItemId.replace('temp-', '');
                if (/^\d+$/.test(part)) sku = part;
            } else if (/^\d+$/.test(recipe.outputItemId)) {
                sku = recipe.outputItemId;
            }
        }

        return TOP_25_SKUS.some(s => s === sku);
    };

    // Sorted Recipes: Priority first, then Alphabetical
    const sortedRecipesOptions = useMemo(() => {
        // We separate recipes into two buckets
        const priority: Recipe[] = [];
        const others: Recipe[] = [];

        recipes.forEach(r => {
            if (isPriorityRecipe(r)) priority.push(r);
            else others.push(r);
        });

        priority.sort((a, b) => a.name.localeCompare(b.name));
        others.sort((a, b) => a.name.localeCompare(b.name));

        const options = [
            { value: '', label: 'Не выбрано...' },
            ...priority.map(r => ({ value: r.id, label: `⭐ ${r.name}` })), // Mark priority
            ...others.map(r => ({ value: r.id, label: r.name }))
        ];
        return options;
    }, [recipes, items]);

    // --- Helper: Smart Stock Lookup ---
    const getSmartTotalStock = (itemId: string, ingredient?: RecipeIngredient) => {
        // 1. Direct ID Match
        const byId = stock.filter(s => s.itemId === itemId).reduce((acc, curr) => acc + curr.quantity, 0);
        if (byId > 0) return byId;

        // 2. Variable ID fallback (if itemId is temp-...)
        // Try to find SKU from the ingredient or tempMaterial
        let skuToSearch = '';

        // If we have access to the ingredient object
        if (ingredient) {
            if (ingredient.tempMaterial?.sku) skuToSearch = ingredient.tempMaterial.sku;
            else {
                // Try to find item details to get SKU
                const item = items.find(i => i.id === itemId);
                if (item?.sku) skuToSearch = item.sku;
            }
        } else {
            const item = items.find(i => i.id === itemId);
            if (item?.sku) skuToSearch = item.sku;
        }

        // If we have a SKU, find the real item
        if (skuToSearch) {
            const realItem = items.find(i => i.sku === skuToSearch);
            if (realItem) {
                // Sum stock for the REAL item ID
                return stock.filter(s => s.itemId === realItem.id).reduce((acc, curr) => acc + curr.quantity, 0);
            }
        }

        return 0;
    };

    // Helper to get total stock for an item
    const getItemTotalStock = (itemId: string) => {
        // Debug specific item stock lookup
        // const itemStockEntries = stock.filter(s => s.itemId === itemId);
        // if (itemStockEntries.length > 0) {
        //     console.log(`[Calc Debug] Found stock for ${itemId}:`, itemStockEntries);
        // }

        return stock
            .filter(s => s.itemId === itemId)
            .reduce((acc, curr) => acc + curr.quantity, 0);
    };

    const getItemDetails = (itemId: string) => {
        return items.find(i => i.id === itemId);
    };

    // Helper to get effective quantity based on monthly norms (Smart Logic)
    // 1. Current Month Norm
    // 2. Most Recent Past Norm (Fallback)
    // 3. Base Quantity
    // Helper to get effective quantity based on monthly norms (Smart Logic)
    // 1. Current Month Norm
    // 2. Most Recent Past Norm (Fallback)
    // 3. Base Quantity
    const getEffectiveQuantity = (ing: any): { value: number; source: 'current' | 'recent' | 'base'; date?: string } => {
        const now = new Date();
        const currentMonthIdx = now.getMonth();
        const currentYear = now.getFullYear();
        // Format: YYYY-MM-01
        const currentMonthStr = `${currentYear}-${String(currentMonthIdx + 1).padStart(2, '0')}-01`;

        if (!ing.monthlyNorms || ing.monthlyNorms.length === 0) {
            return { value: ing.quantity, source: 'base' };
        }

        // 1. Try Exact Match
        const exactMatch = ing.monthlyNorms.find((n: any) => n.date === currentMonthStr);
        if (exactMatch && exactMatch.quantity > 0) {
            return { value: exactMatch.quantity, source: 'current', date: exactMatch.date };
        }

        // 2. Try Most Recent Past
        // Filter norms that are strictly in the past (< currentMonthStr)
        const pastNorms = ing.monthlyNorms.filter((n: any) => n.date < currentMonthStr && n.quantity > 0);
        if (pastNorms.length > 0) {
            // Sort descending (newest first)
            pastNorms.sort((a: any, b: any) => b.date.localeCompare(a.date));
            const recent = pastNorms[0];
            return { value: recent.quantity, source: 'recent', date: recent.date };
        }

        // 3. Fallback to Base
        return { value: ing.quantity, source: 'base' };
    };

    // --- Mode 1: Max Output Analysis ---
    const analysisResults = useMemo(() => {
        if (!selectedRecipeId || recipes.length === 0) return null;
        const recipe = recipes.find(r => r.id === selectedRecipeId);
        if (!recipe) return null;

        // Use effective quantity to filter
        const validIngredients = recipe.ingredients
            .map(ing => {
                const effective = getEffectiveQuantity(ing);
                return { ...ing, effectiveQuantity: effective };
            })
            .filter(ing => ing.effectiveQuantity.value > 0);

        if (validIngredients.length === 0) return {
            recipeName: recipe.name,
            ingredients: [],
            overallMaxBatches: 999999,
            overallMaxUnits: 999999,
            limitingFactor: null,
            isUnlimited: true,
            unlimitedReason: 'Нет ингредиентов или норм'
        };

        const results = validIngredients.map(ing => {
            const item = getItemDetails(ing.itemId);
            const totalStock = getSmartTotalStock(ing.itemId, ing);

            const requiredPerBatch = ing.effectiveQuantity.value;

            // How many full runs can we make?
            const maxBatches = requiredPerBatch > 0 ? Math.floor(totalStock / requiredPerBatch) : 999999;
            const maxTotalUnits = maxBatches * recipe.outputQuantity;

            const status = maxBatches <= 0 ? 'critical' : maxBatches < 10 ? 'warning' : 'ok';

            return {
                itemId: ing.itemId,
                sku: item?.sku || ing.tempMaterial?.sku || '-',
                itemName: item?.name || ing.tempMaterial?.name || ing.itemId,
                unit: item?.unit || ing.unit || '',
                requiredPerBatch,
                totalStock,
                maxBatches,
                maxTotalUnits,
                status,
                normSource: ing.effectiveQuantity.source,
                normDate: ing.effectiveQuantity.date
            };
        });

        results.sort((a, b) => a.maxBatches - b.maxBatches);
        const overallMaxBatches = Math.min(...results.map(r => r.maxBatches));

        // If overallMaxBatches is still super high, it means we have enough stock for "infinite" production practically, or error
        const isUnlimited = overallMaxBatches >= 999999;

        const overallMaxUnits = isUnlimited ? 999999 : overallMaxBatches * recipe.outputQuantity;
        const limitingFactor = isUnlimited ? null : results.find(r => r.maxBatches === overallMaxBatches);

        return {
            recipeName: recipe.name,
            ingredients: results,
            overallMaxBatches,
            overallMaxUnits,
            limitingFactor,
            isUnlimited,
            unlimitedReason: isUnlimited ? 'Нет ограничений по материалам' : null
        };
    }, [selectedRecipeId, recipes, stock, items]);

    // --- Mode 2: Forward Planning ---
    const planningResults = useMemo(() => {
        if (!selectedRecipeId || targetQuantity <= 0 || recipes.length === 0) return null;
        const recipe = recipes.find(r => r.id === selectedRecipeId);
        if (!recipe) return null;

        const batchesNeeded = targetQuantity / recipe.outputQuantity;

        const results = recipe.ingredients.map(ing => {
            const item = getItemDetails(ing.itemId);
            const totalStock = getSmartTotalStock(ing.itemId, ing);

            const effective = getEffectiveQuantity(ing);
            const requiredTotal = effective.value * batchesNeeded;
            const projectedBalance = totalStock - requiredTotal;
            const isShortage = projectedBalance < 0;

            return {
                itemId: ing.itemId,
                sku: item?.sku || ing.tempMaterial?.sku || '-',
                itemName: item?.name || ing.tempMaterial?.name || ing.itemId,
                unit: item?.unit || ing.unit || '',
                requiredTotal,
                totalStock,
                projectedBalance,
                isShortage,
                effectiveValue: effective.value,
                normSource: effective.source,
                normDate: effective.date
            };
        });

        // Filter out items with 0 requirement (if using effective quantity)
        const activeResults = results.filter(r => r.requiredTotal > 0);

        return { recipeName: recipe.name, ingredients: activeResults, batchesNeeded };
    }, [selectedRecipeId, targetQuantity, recipes, stock, items]);


    if (loadingRecipes || loadingInventory) {
        return (
            <div className="flex items-center justify-center p-12">
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                <span className="ml-3 text-slate-400">Загрузка данных...</span>
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold text-slate-100 flex items-center gap-3">
                        <Calculator className="w-8 h-8 text-blue-500" />
                        Калькулятор
                    </h1>
                    <p className="text-slate-400 mt-1">Планирование производства и расчет потребности в материалах</p>
                </div>
            </div>

            {/* Mode Toggle */}
            <div className="flex gap-4 border-b border-slate-700">
                <button
                    onClick={() => setMode('analyze')}
                    className={clsx(
                        "px-6 py-3 font-medium transition-colors border-b-2 flex items-center gap-2",
                        mode === 'analyze' ? "border-emerald-500 text-emerald-400" : "border-transparent text-slate-400 hover:text-slate-200"
                    )}
                >
                    <TrendingUp size={18} />
                    Анализ возможностей
                </button>
                <button
                    onClick={() => setMode('plan')}
                    className={clsx(
                        "px-6 py-3 font-medium transition-colors border-b-2 flex items-center gap-2",
                        mode === 'plan' ? "border-blue-500 text-blue-400" : "border-transparent text-slate-400 hover:text-slate-200"
                    )}
                >
                    <CalendarClock size={18} />
                    Планирование заказа
                </button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Параметры {mode === 'analyze' ? 'анализа' : 'планирования'}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Select
                        label="Выберите продукт (Тех. Карту)"
                        options={sortedRecipesOptions}
                        value={selectedRecipeId}
                        onChange={e => setSelectedRecipeId(e.target.value)}
                    />

                    {mode === 'plan' && (
                        <div className="pt-2 space-y-4">
                            <div>
                                <Input
                                    label="Планируемый объем (КГ / Ед)"
                                    type="number"
                                    placeholder="Например: 500"
                                    value={targetQuantity || ''}
                                    onChange={(e) => setTargetQuantity(parseFloat(e.target.value) || 0)}
                                />
                                <p className="text-xs text-slate-500 mt-1">
                                    Введите количество готовой продукции, которое вы хотите произвести.
                                </p>
                            </div>

                            {targetQuantity > 0 && selectedRecipeId && (
                                <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 flex gap-8">
                                    {/* Mock conversions or estimates if needed. For now just show output quantity relation */}
                                    <div>
                                        <p className="text-xs text-slate-400 uppercase">Потребуется варок/замесов</p>
                                        <p className="text-xl font-bold text-slate-100">
                                            {planningResults ? planningResults.batchesNeeded.toFixed(2) : '-'}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* --- VIEW: ANALYZE --- */}
            {mode === 'analyze' && analysisResults && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card className="bg-slate-900 border-emerald-900/50">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-emerald-400 text-lg">Максимальный выпуск</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-5xl font-bold text-slate-100 mb-2">
                                    {analysisResults.isUnlimited ? '∞' : analysisResults.overallMaxUnits.toLocaleString() + ' ед'}
                                </div>
                                <p className="text-slate-400">
                                    {analysisResults.isUnlimited
                                        ? (analysisResults.unlimitedReason || 'Нет ограничений')
                                        : `~${analysisResults.overallMaxBatches} партий (замесов)`
                                    }
                                </p>
                            </CardContent>
                        </Card>

                        <Card className={`border-l-4 ${analysisResults.limitingFactor ? 'border-l-amber-500' : 'border-l-emerald-500'}`}>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-slate-200 text-lg">Лимитирующий фактор (Узкое горлышко)</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {analysisResults.limitingFactor ? (
                                    <>
                                        <div className="text-xl font-medium text-slate-100 mb-1">
                                            {analysisResults.limitingFactor.itemName}
                                        </div>
                                        <p className="text-slate-400">
                                            Хватит только на {analysisResults.limitingFactor.maxTotalUnits.toLocaleString()} шт
                                        </p>
                                        <div className="mt-2 text-sm text-slate-500">
                                            На складе: {analysisResults.limitingFactor.totalStock} {analysisResults.limitingFactor.unit}
                                        </div>
                                        <div className="mt-1 text-xs text-slate-600">
                                            Норма: {analysisResults.limitingFactor.requiredPerBatch} ({analysisResults.limitingFactor.normSource === 'current' ? 'Тек.месяц' : analysisResults.limitingFactor.normSource === 'recent' ? `План ${new Date(analysisResults.limitingFactor.normDate!).toLocaleDateString('ru-RU', { month: 'short', year: '2-digit' })}` : 'Базовая'})
                                        </div>
                                    </>
                                ) : (
                                    <p className="text-emerald-500 font-medium">
                                        {analysisResults.isUnlimited ? "Недостаточно данных для расчета ограничений" : "Ограничений нет"}
                                    </p>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            )}

            {/* --- VIEW: PLAN --- */}
            {mode === 'plan' && planningResults && (
                <Card className="border-t-4 border-t-blue-500">
                    <CardHeader>
                        <CardTitle>Расчет потребности материалов</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        {planningResults.ingredients.length === 0 ? (
                            <div className="p-8 text-center flex flex-col items-center justify-center text-slate-500">
                                <AlertCircle className="w-12 h-12 mb-3 text-slate-600" />
                                <p className="text-lg font-medium text-slate-400">Нет данных о материалах</p>
                                <p className="text-sm mt-1">Для выбранной техкарты не найдены активные нормы расхода или ингредиенты.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-950 text-slate-400 font-medium uppercase">
                                        <tr>
                                            <th className="px-6 py-3">Артикул</th>
                                            <th className="px-6 py-3">Материал</th>
                                            <th className="px-6 py-3 text-right">На складе</th>
                                            <th className="px-6 py-3 text-right text-blue-400">Требуется</th>
                                            <th className="px-6 py-3 text-right">Остаток после</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800">
                                        {planningResults.ingredients.map(row => (
                                            <tr key={row.itemId} className="hover:bg-slate-800/50">
                                                <td className="px-6 py-4 font-mono text-slate-500">
                                                    {row.sku}
                                                </td>
                                                <td className="px-6 py-4 font-medium text-slate-200">
                                                    <div className="flex flex-col">
                                                        <span>{row.itemName}</span>
                                                        <span className="text-xs text-slate-500 font-normal">
                                                            Норма: {row.effectiveValue} {row.unit}
                                                            <span className={clsx("ml-1",
                                                                row.normSource === 'current' ? "text-emerald-500" :
                                                                    row.normSource === 'recent' ? "text-amber-500" : "text-slate-600"
                                                            )}>
                                                                ({row.normSource === 'current' ? 'Тек.месяц' : row.normSource === 'recent' ? `из ${new Date(row.normDate!).toLocaleDateString('ru-RU', { month: 'short', year: '2-digit' })}` : 'Базовая'})
                                                            </span>
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-right text-slate-400">
                                                    {row.totalStock.toLocaleString()} <span className="text-xs">{row.unit}</span>
                                                </td>
                                                <td className="px-6 py-4 text-right text-blue-300 font-medium">
                                                    {row.requiredTotal.toFixed(3)} <span className="text-xs">{row.unit}</span>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <span className={clsx(
                                                        "font-medium",
                                                        row.isShortage ? "text-red-500" : "text-emerald-400"
                                                    )}>
                                                        {row.projectedBalance.toFixed(3)}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
