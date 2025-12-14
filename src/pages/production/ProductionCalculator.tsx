import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Select } from '../../components/ui/Select';
import { Input } from '../../components/ui/Input';

import { MOCK_RECIPES } from '../../data/mockProduction';
import { MOCK_STOCK, MOCK_ITEMS } from '../../data/mockInventory';
import { Calculator, AlertTriangle, CheckCircle, TrendingUp, CalendarClock } from 'lucide-react';
import { clsx } from 'clsx';

export default function ProductionCalculator() {
    const [mode, setMode] = useState<'analyze' | 'plan'>('analyze');
    const [selectedRecipeId, setSelectedRecipeId] = useState<string>('');
    const [targetQuantity, setTargetQuantity] = useState<number>(0);

    // --- Mode 1: Max Output Analysis ---
    const analysisResults = useMemo(() => {
        if (!selectedRecipeId) return null;
        const recipe = MOCK_RECIPES.find(r => r.id === selectedRecipeId);
        if (!recipe) return null;

        const results = recipe.ingredients.map(ing => {
            const item = MOCK_ITEMS.find(i => i.id === ing.itemId);
            const totalStock = MOCK_STOCK
                .filter(s => s.itemId === ing.itemId)
                .reduce((acc, curr) => acc + curr.quantity, 0);

            const requiredPerBatch = ing.quantity; // amount for Recipe base (usually 1 batch or X units)
            // For simplicity, assume MOCK_RECIPE defines requirements for 1000 packs (batch).
            // We need to know how many "packs" total can be made.
            // Recipe: "outputQuantity" = 1000. "ing.quantity" is for 1000.

            const maxBatches = requiredPerBatch > 0 ? Math.floor(totalStock / requiredPerBatch) : 999999;
            const maxTotalUnits = maxBatches * recipe.outputQuantity;

            const status = maxBatches <= 0 ? 'critical' : maxBatches < 10 ? 'warning' : 'ok';

            return {
                itemId: ing.itemId,
                itemName: item?.name || ing.itemId,
                unit: item?.unit || '',
                requiredPerBatch,
                totalStock,
                maxBatches,
                maxTotalUnits,
                status
            };
        });

        results.sort((a, b) => a.maxBatches - b.maxBatches);
        const overallMaxBatches = Math.min(...results.map(r => r.maxBatches));
        const overallMaxUnits = overallMaxBatches * recipe.outputQuantity;
        const limitingFactor = results.find(r => r.maxBatches === overallMaxBatches);

        return { recipeName: recipe.name, ingredients: results, overallMaxBatches, overallMaxUnits, limitingFactor };
    }, [selectedRecipeId]);

    // --- Mode 2: Forward Planning ---
    const planningResults = useMemo(() => {
        if (!selectedRecipeId || targetQuantity <= 0) return null;
        const recipe = MOCK_RECIPES.find(r => r.id === selectedRecipeId);
        if (!recipe) return null;

        const batchesNeeded = targetQuantity / recipe.outputQuantity;

        const results = recipe.ingredients.map(ing => {
            const item = MOCK_ITEMS.find(i => i.id === ing.itemId);
            const totalStock = MOCK_STOCK
                .filter(s => s.itemId === ing.itemId)
                .reduce((acc, curr) => acc + curr.quantity, 0);

            const requiredTotal = ing.quantity * batchesNeeded;
            const projectedBalance = totalStock - requiredTotal;
            const isShortage = projectedBalance < 0;

            return {
                itemId: ing.itemId,
                itemName: item?.name || ing.itemId,
                unit: item?.unit || '',
                requiredTotal,
                totalStock,
                projectedBalance,
                isShortage
            };
        });

        return { recipeName: recipe.name, ingredients: results, batchesNeeded };
    }, [selectedRecipeId, targetQuantity]);


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
                        options={[
                            { value: '', label: 'Не выбрано...' },
                            ...MOCK_RECIPES.map(r => ({ value: r.id, label: r.name }))
                        ]}
                        value={selectedRecipeId}
                        onChange={e => setSelectedRecipeId(e.target.value)}
                    />

                    {mode === 'plan' && (
                        <div className="pt-2 space-y-4">
                            <div>
                                <Input
                                    label="Планируемый объем (КГ)"
                                    type="number"
                                    placeholder="Например: 500"
                                    value={targetQuantity || ''}
                                    onChange={(e) => setTargetQuantity(parseInt(e.target.value) || 0)}
                                />
                                <p className="text-xs text-slate-500 mt-1">
                                    Введите вес готовой продукции.
                                </p>
                            </div>

                            {targetQuantity > 0 && selectedRecipeId && (
                                <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 flex gap-8">
                                    <div>
                                        <p className="text-xs text-slate-400 uppercase">Штук (Пачек)</p>
                                        <p className="text-xl font-bold text-slate-100">
                                            {/* Mock: 1 pack = 0.1kg implied? No, let's assume recipe outputQuantity is 'units per batch'. 
                                                We need a conversion factor. For MVP, let's assume 1 Batch = 100kg = 1000 packs.
                                                So 1 kg = 10 packs.
                                            */}
                                            {(targetQuantity * 10).toLocaleString()} шт
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-400 uppercase">Ящиков</p>
                                        <p className="text-xl font-bold text-slate-100">
                                            {/* Mock: 1 box = 20 packs */}
                                            {Math.ceil((targetQuantity * 10) / 20).toLocaleString()} ящ
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
                                    {analysisResults.overallMaxUnits} шт
                                </div>
                                <p className="text-slate-400">
                                    ~{analysisResults.overallMaxBatches} партий
                                </p>
                            </CardContent>
                        </Card>

                        <Card className={`border-l-4 ${analysisResults.overallMaxBatches === 0 ? 'border-l-red-500' : 'border-l-amber-500'}`}>
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
                                            Хватит только на {analysisResults.limitingFactor.maxTotalUnits} шт
                                        </p>
                                    </>
                                ) : (
                                    <p className="text-emerald-500 font-medium">Ограничений нет</p>
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
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-950 text-slate-400 font-medium uppercase">
                                    <tr>
                                        <th className="px-6 py-3">Материал</th>
                                        <th className="px-6 py-3 text-right">На складе</th>
                                        <th className="px-6 py-3 text-right text-blue-400">Требуется</th>
                                        <th className="px-6 py-3 text-right">Остаток после</th>
                                        <th className="px-6 py-3">Статус</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800">
                                    {planningResults.ingredients.map(row => (
                                        <tr key={row.itemId} className="hover:bg-slate-800/50">
                                            <td className="px-6 py-4 font-medium text-slate-200">{row.itemName}</td>
                                            <td className="px-6 py-4 text-right text-slate-400">
                                                {row.totalStock} <span className="text-xs">{row.unit}</span>
                                            </td>
                                            <td className="px-6 py-4 text-right text-blue-300 font-medium">
                                                {row.requiredTotal.toFixed(2)} <span className="text-xs">{row.unit}</span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <span className={row.isShortage ? 'text-red-500 font-bold' : 'text-emerald-400'}>
                                                    {row.projectedBalance.toFixed(2)}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                {row.isShortage ? (
                                                    <span className="inline-flex items-center px-2 py-1 rounded bg-red-900/30 text-red-400 text-xs font-bold">
                                                        <AlertTriangle className="w-3 h-3 mr-1" />
                                                        ДЕФИЦИТ
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center px-2 py-1 rounded bg-emerald-900/30 text-emerald-400 text-xs font-medium">
                                                        <CheckCircle className="w-3 h-3 mr-1" />
                                                        ХВАТАЕТ
                                                    </span>
                                                )}
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
    );
}
