import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Select } from '../../components/ui/Select';
import { Input } from '../../components/ui/Input';

import { Calculator, TrendingUp, CalendarClock, Loader2, AlertCircle } from 'lucide-react';
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

    // Helper for fuzzy SKU matching
    const normalizeSku = (sku: string) => {
        if (!sku) return '';
        return sku.toString()
            .toLowerCase()
            .trim()
            .replace(/\\/g, '/')   // Normalize backslashes
            .replace(/\s+/g, '');  // Remove ALL whitespace (e.g. "8141 / 1 " -> "8141/1")
    };

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

        // If we have a SKU, find ALL real items (aggregating duplicates)
        if (skuToSearch) {
            // Normalize for search
            const searchSku = normalizeSku(skuToSearch);

            // Find ALL matching items (duplicates included)
            const matchingItems = items.filter(i => {
                if (i.sku === skuToSearch) return true; // Exact match
                if (normalizeSku(i.sku) === searchSku) return true; // Normalized match
                return false;
            });

            if (matchingItems.length > 0) {
                // Get IDs of all matching items
                const validIds = matchingItems.map(i => i.id);

                // Sum stock for ALL these IDs
                const totalVal = stock
                    .filter(s => validIds.includes(s.itemId))
                    .reduce((acc, curr) => acc + curr.quantity, 0);

                // DEBUG: Trace specific SKUs for user debugging
                if (searchSku.includes('8141') || searchSku.includes('/')) {
                    if (totalVal === 0) {
                        const stockLevels = stock.filter(s => validIds.includes(s.itemId));
                        console.warn(`[Calc] Debug ${skuToSearch} (Norm: ${searchSku}): Found ${validIds.length} items. IDs: ${validIds.join(', ')}. Aggregated Stock: ${totalVal}. Levels:`, stockLevels);
                    } else {
                        // console.log(`[Calc] Debug ${skuToSearch}: Resolved ${validIds.length} items with Total Stock ${totalVal}`);
                    }
                }

                if (totalVal > 0) return totalVal;
            } else {
                // DEBUG: Log breakdown of why it failed (No matching items found)
                if (searchSku.includes('8141') || searchSku.includes('/')) {
                    console.warn(`[Calc] FAILED to resolve: "${skuToSearch}"`);
                    console.log(`[Calc]   - Search Normalized: "${searchSku}"`);
                    console.log(`[Calc]   - Chars: ${skuToSearch.split('').map(c => c.charCodeAt(0)).join(',')}`);

                    // Try to find ANY match using includes
                    const looseMatch = items.find(i => normalizeSku(i.sku).includes(searchSku) || searchSku.includes(normalizeSku(i.sku)));
                    if (looseMatch) {
                        console.log(`[Calc]   - Did you mean: "${looseMatch.sku}" (Norm: ${normalizeSku(looseMatch.sku)})?`);
                    }
                }
            }
        }

        return 0;
    };

    const getItemDetails = (itemId: string) => {
        return items.find(i => i.id === itemId);
    };

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
                return { ...ing, quantity: effective.value, effectiveSource: effective.source, effectiveDate: effective.date };
            })
            .filter(ing => ing.quantity > 0);

        if (validIngredients.length === 0) return null;

        const ingredientLimits = validIngredients.map(ing => {
            const stockQty = getSmartTotalStock(ing.itemId, ing);
            const canProduce = Math.floor(stockQty / ing.quantity);
            const isUnlimited = ing.tempMaterial?.sku === '2010420'; // Example unlimited item
            return {
                ingredientName: ing.tempMaterial?.name || getItemDetails(ing.itemId)?.name || 'Unknown',
                requiredPerUnit: ing.quantity,
                inStock: stockQty,
                maxOutput: isUnlimited ? Infinity : canProduce,
                isLimiting: false, // will calculate below
                isUnlimited,
                unlimitedReason: isUnlimited ? 'Всегда в наличии' : undefined,
                effectiveSource: ing.effectiveSource,
                sku: ing.tempMaterial?.sku || getItemDetails(ing.itemId)?.sku || ''
            };
        });

        // Find min output (ignoring unlimited items)
        const finiteLimits = ingredientLimits.filter(i => !i.isUnlimited);
        const maxPossibleOutput = finiteLimits.length > 0
            ? Math.min(...finiteLimits.map(i => i.maxOutput))
            : Infinity; // If all unlimited (rare)

        // Mark limiting factors
        const limitingIngredients = ingredientLimits.filter(i => !i.isUnlimited && i.maxOutput === maxPossibleOutput);
        limitingIngredients.forEach(i => i.isLimiting = true);

        return {
            recipeName: recipe.name,
            maxPossibleOutput: maxPossibleOutput === Infinity ? '∞' : maxPossibleOutput,
            ingredients: ingredientLimits
        };
    }, [selectedRecipeId, recipes, stock, items]);

    // --- Mode 2: Plan Requirement ---
    const planningResults = useMemo(() => {
        if (!selectedRecipeId || targetQuantity <= 0 || recipes.length === 0) return null;
        const recipe = recipes.find(r => r.id === selectedRecipeId);
        if (!recipe) return null;

        const requirements = recipe.ingredients
            .map(ing => {
                const effective = getEffectiveQuantity(ing);
                return { ...ing, quantity: effective.value, effectiveSource: effective.source };
            })
            .filter(ing => ing.quantity > 0)
            .map(ing => {
                const requiredTotal = ing.quantity * targetQuantity;
                const stockQty = getSmartTotalStock(ing.itemId, ing);
                const balance = stockQty - requiredTotal;
                const isUnlimited = ing.tempMaterial?.sku === '2010420'; // Example

                return {
                    ingredientName: ing.tempMaterial?.name || getItemDetails(ing.itemId)?.name || 'Unknown',
                    requiredTotal,
                    inStock: stockQty,
                    balance,
                    status: isUnlimited ? 'OK' : (balance >= 0 ? 'OK' : 'Deficit'),
                    sku: ing.tempMaterial?.sku || getItemDetails(ing.itemId)?.sku || ''
                };
            });

        return {
            recipeName: recipe.name,
            ingredients: requirements
        };
    }, [selectedRecipeId, targetQuantity, recipes, stock, items]);


    const handleRecipeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setSelectedRecipeId(e.target.value);
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-slate-100 flex items-center gap-2">
                        <Calculator className="w-8 h-8 text-blue-500" />
                        Производственный Калькулятор
                    </h1>
                    <p className="text-slate-400 mt-1">Расчет доступного производства и планирование потребностей</p>
                </div>

                <div className="flex bg-slate-800 p-1 rounded-lg border border-slate-700">
                    <button
                        onClick={() => setMode('analyze')}
                        className={clsx(
                            "px-4 py-2 rounded-md text-sm font-medium transition-all",
                            mode === 'analyze'
                                ? "bg-blue-600 text-white shadow-lg"
                                : "text-slate-400 hover:text-white hover:bg-slate-700"
                        )}
                    >
                        <TrendingUp className="w-4 h-4 inline mr-2" />
                        Анализ остатков
                    </button>
                    <button
                        onClick={() => setMode('plan')}
                        className={clsx(
                            "px-4 py-2 rounded-md text-sm font-medium transition-all",
                            mode === 'plan'
                                ? "bg-purple-600 text-white shadow-lg"
                                : "text-slate-400 hover:text-white hover:bg-slate-700"
                        )}
                    >
                        <CalendarClock className="w-4 h-4 inline mr-2" />
                        Планирование заказа
                    </button>
                </div>
            </div>

            {/* Controls */}
            <Card className="border-slate-800 bg-slate-900/50">
                <CardContent className="pt-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-300">Выберите техкарту (рецепт)</label>
                            <Select
                                value={selectedRecipeId}
                                options={sortedRecipesOptions}
                                onChange={handleRecipeChange}
                                className="w-full"
                            />
                        </div>

                        {mode === 'plan' && (
                            <div className="space-y-2 animate-in fade-in slide-in-from-left-4">
                                <label className="text-sm font-medium text-slate-300">Планируемый выпуск (ящиков)</label>
                                <Input
                                    type="number"
                                    value={targetQuantity || ''}
                                    onChange={(e) => setTargetQuantity(parseInt(e.target.value) || 0)}
                                    placeholder="Введите количество..."
                                    className="bg-slate-950 border-slate-700"
                                />
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Results Area */}
            {loadingRecipes ? (
                <div className="flex justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                </div>
            ) : (
                <>
                    {/* Mode 1: Analysis Results */}
                    {mode === 'analyze' && analysisResults && (
                        <div className="space-y-6 animate-in zoom-in-95 duration-300">
                            {/* Summary Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700">
                                    <CardContent className="pt-6">
                                        <div className="text-slate-400 text-sm font-medium">Максимально возможно</div>
                                        <div className="text-4xl font-bold text-white mt-2">
                                            {analysisResults.maxPossibleOutput}
                                            <span className="text-lg text-slate-500 font-normal ml-2">ящ</span>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Detailed Breakdown */}
                            <Card className="border-slate-800">
                                <CardHeader>
                                    <CardTitle>Детализация по компонентам</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm text-left">
                                            <thead className="text-slate-400 border-b border-slate-800">
                                                <tr>
                                                    <th className="py-3 px-4">Артикул</th>
                                                    <th className="py-3 px-4">Компонент</th>
                                                    <th className="py-3 px-4 text-right">На 1 ящ</th>
                                                    <th className="py-3 px-4 text-right">На остатке</th>
                                                    <th className="py-3 px-4 text-right">Хватит на</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-800">
                                                {analysisResults.ingredients.map((ing, idx) => (
                                                    <tr key={idx} className={clsx(
                                                        "transition-colors hover:bg-slate-800/50",
                                                        ing.isLimiting && "bg-red-900/10"
                                                    )}>
                                                        <td className="py-3 px-4 text-slate-400 font-mono">{ing.sku}</td>
                                                        <td className="py-3 px-4 font-medium text-slate-200">
                                                            {ing.ingredientName}
                                                            {ing.effectiveSource !== 'base' && (
                                                                <span className="ml-2 text-xs text-blue-400 bg-blue-400/10 px-1.5 py-0.5 rounded">
                                                                    {ing.effectiveSource === 'current' ? 'Тек.месяц' : 'Прошлый'}
                                                                </span>
                                                            )}
                                                            {ing.isLimiting && (
                                                                <span className="ml-2 text-xs text-red-400 border border-red-400/30 px-1.5 py-0.5 rounded">
                                                                    Лимитирует
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="py-3 px-4 text-right text-slate-300">{ing.requiredPerUnit}</td>
                                                        <td className="py-3 px-4 text-right text-slate-300">{ing.inStock}</td>
                                                        <td className={clsx(
                                                            "py-3 px-4 text-right font-bold",
                                                            ing.isLimiting ? "text-red-400" : "text-emerald-400"
                                                        )}>
                                                            {ing.isUnlimited ? (
                                                                <span className="text-xs text-emerald-500/70">{ing.unlimitedReason}</span>
                                                            ) : (
                                                                Math.floor(ing.maxOutput)
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    )}

                    {/* Mode 2: Plan Results */}
                    {mode === 'plan' && planningResults && (
                        <div className="space-y-6 animate-in zoom-in-95 duration-300">
                            {planningResults.ingredients.length === 0 ? (
                                <div className="text-center py-12 text-slate-500">
                                    <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                    <p>Нет ингредиентов для расчета</p>
                                </div>
                            ) : (
                                <Card className="border-slate-800">
                                    <CardHeader>
                                        <CardTitle>План закупки / Производства</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm text-left">
                                                <thead className="text-slate-400 border-b border-slate-800">
                                                    <tr>
                                                        <th className="py-3 px-4">Артикул</th>
                                                        <th className="py-3 px-4">Компонент</th>
                                                        <th className="py-3 px-4 text-right">Потребуется</th>
                                                        <th className="py-3 px-4 text-right">Есть на складе</th>
                                                        <th className="py-3 px-4 text-right">Баланс</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-800">
                                                    {planningResults.ingredients.map((ing, idx) => (
                                                        <tr key={idx} className="hover:bg-slate-800/50 transition-colors">
                                                            <td className="py-3 px-4 text-slate-400 font-mono">{ing.sku}</td>
                                                            <td className="py-3 px-4 font-medium text-slate-200">{ing.ingredientName}</td>
                                                            <td className="py-3 px-4 text-right text-slate-300">{ing.requiredTotal.toFixed(2)}</td>
                                                            <td className="py-3 px-4 text-right text-slate-300">{ing.inStock}</td>
                                                            <td className={clsx(
                                                                "py-3 px-4 text-right font-bold",
                                                                ing.balance >= 0 ? "text-emerald-400" : "text-red-400"
                                                            )}>
                                                                {ing.balance >= 0 ? `+${ing.balance.toFixed(2)}` : ing.balance.toFixed(2)}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}
                        </div>
                    )}

                    {!selectedRecipeId && (
                        <div className="text-center py-20 text-slate-500 border-2 border-dashed border-slate-800 rounded-xl bg-slate-900/30">
                            <Calculator className="w-12 h-12 mx-auto mb-4 opacity-20" />
                            <p className="text-lg">Выберите техкарту чтобы начать расчет</p>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
