import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { useInventory } from '../../hooks/useInventory';
import { useLanguage } from '../../context/LanguageContext';
import { Calendar, ChevronLeft, ChevronRight, Upload } from 'lucide-react';
import ExcelImportModal from '../inventory/ExcelImportModal';
import { clsx } from 'clsx';

export default function ProductionPlanning() {
    const { t, language } = useLanguage();
    const { items, stock, plannedConsumption, loading, refresh } = useInventory();
    
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [selectedCategory, setSelectedCategory] = useState<string>('packaging_cardboard');
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [refreshKey, setRefreshKey] = useState(0);

    // Force refresh when component mounts or when refreshKey changes
    useEffect(() => {
        refresh();
    }, [refreshKey]);

    // Refresh data when import modal closes
    const handleImportClose = () => {
        setIsImportModalOpen(false);
        // Force refresh after a short delay to ensure data is saved
        setTimeout(() => {
            refresh();
            setRefreshKey(prev => prev + 1);
        }, 500);
    };

    // Ensure items, stock, and plannedConsumption are arrays
    const safeItems = Array.isArray(items) ? items : [];
    const safeStock = Array.isArray(stock) ? stock : [];
    const safePlannedConsumption = Array.isArray(plannedConsumption) ? plannedConsumption : [];

    // Get all unique categories
    const categories = useMemo(() => {
        if (!Array.isArray(safeItems)) return [];
        return [...new Set(safeItems.map(item => item.category))].sort();
    }, [safeItems]);

    // Get month name
    const getMonthName = (month: number) => {
        const date = new Date(selectedYear, month, 1);
        return date.toLocaleDateString(language === 'uk' ? 'uk-UA' : 'ru-RU', { month: 'long' });
    };

    // Navigate months
    const navigateMonth = (direction: 'prev' | 'next') => {
        if (direction === 'next') {
            if (selectedMonth === 11) {
                setSelectedMonth(0);
                setSelectedYear(selectedYear + 1);
            } else {
                setSelectedMonth(selectedMonth + 1);
            }
        } else {
            if (selectedMonth === 0) {
                setSelectedMonth(11);
                setSelectedYear(selectedYear - 1);
            } else {
                setSelectedMonth(selectedMonth - 1);
            }
        }
    };

    // Go to current month
    const goToCurrentMonth = () => {
        const now = new Date();
        setSelectedMonth(now.getMonth());
        setSelectedYear(now.getFullYear());
    };

    // Calculate planned consumption for selected month
    const monthStart = new Date(selectedYear, selectedMonth, 1);
    const monthEnd = new Date(selectedYear, selectedMonth + 1, 0);
    const monthStartStr = monthStart.toISOString().split('T')[0];
    const monthEndStr = monthEnd.toISOString().split('T')[0];

    // Filter items by category
    const filteredItems = useMemo(() => {
        if (!Array.isArray(safeItems)) return [];
        if (selectedCategory === 'all') return safeItems;
        return safeItems.filter(item => item.category === selectedCategory);
    }, [safeItems, selectedCategory]);

    // Calculate planning data for each item
    const planningData = useMemo(() => {
        return filteredItems.map(item => {
            // Get stock levels for this item
            const itemStock = safeStock.filter(s => s.itemId === item.id);
            const totalStock = itemStock.reduce((acc, curr) => acc + (curr.quantity || 0), 0);

            // Get planned consumption for this month
            const itemPlannedConsumption = safePlannedConsumption.filter(pc => 
                pc.itemId === item.id &&
                pc.plannedDate >= monthStartStr &&
                pc.plannedDate <= monthEndStr
            );
            const totalPlannedConsumption = itemPlannedConsumption.reduce((acc, curr) => acc + (curr.quantity || 0), 0);

            // Calculate required order (planned - stock, but not less than 0)
            const requiredOrder = Math.max(0, totalPlannedConsumption - totalStock);

            return {
                item,
                totalStock,
                totalPlannedConsumption,
                requiredOrder,
                stockLevels: itemStock
            };
        }).filter(data => 
            // Show only items with planned consumption or stock
            data.totalPlannedConsumption > 0 || data.totalStock > 0
        ).sort((a, b) => {
            // Sort by required order (descending), then by planned consumption
            if (b.requiredOrder !== a.requiredOrder) {
                return b.requiredOrder - a.requiredOrder;
            }
            return b.totalPlannedConsumption - a.totalPlannedConsumption;
        });
    }, [filteredItems, safeStock, safePlannedConsumption, monthStartStr, monthEndStr]);

    // Calculate totals
    const totals = useMemo(() => {
        return planningData.reduce((acc, data) => ({
            stock: acc.stock + data.totalStock,
            planned: acc.planned + data.totalPlannedConsumption,
            required: acc.required + data.requiredOrder
        }), { stock: 0, planned: 0, required: 0 });
    }, [planningData]);

    return (
        <div className="space-y-6 p-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">{t('production.planning') || 'Планирование'}</h1>
                    <p className="text-slate-400 mt-1">{t('production.planningDesc') || 'План расхода материалов, фактическое наличие и необходимый заказ'}</p>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        onClick={() => {
                            refresh();
                            setRefreshKey(prev => prev + 1);
                        }}
                        className="border-slate-600 hover:bg-slate-800"
                        disabled={loading}
                    >
                        <Calendar className="w-4 h-4 mr-2" />
                        {loading ? (t('common.loading') || 'Загрузка...') : (t('common.refresh') || 'Обновить')}
                    </Button>
                    <Button
                        onClick={() => setIsImportModalOpen(true)}
                        className="bg-emerald-600 hover:bg-emerald-700"
                    >
                        <Upload className="w-4 h-4 mr-2" />
                        {t('production.importPlan') || 'Импорт плана'}
                    </Button>
                </div>
            </div>

            {error && (
                <Card className="bg-red-900/20 border-red-500">
                    <CardContent className="pt-6">
                        <p className="text-red-400">{error}</p>
                    </CardContent>
                </Card>
            )}

            {/* Filters */}
            <Card>
                <CardContent className="pt-6">
                    <div className="flex flex-wrap gap-4 items-end">
                        {/* Month Navigation */}
                        <div className="flex items-center gap-2">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => navigateMonth('prev')}
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </Button>
                            <div className="flex items-center gap-2 min-w-[200px]">
                                <Calendar className="w-4 h-4 text-slate-400" />
                                <span className="text-slate-200 font-medium capitalize">
                                    {getMonthName(selectedMonth)} {selectedYear}
                                </span>
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => navigateMonth('next')}
                            >
                                <ChevronRight className="w-4 h-4" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={goToCurrentMonth}
                                className="ml-2"
                            >
                                {t('production.currentMonth') || 'Актуальный месяц'}
                            </Button>
                        </div>

                        {/* Category Filter */}
                        <div className="flex-1 min-w-[200px]">
                            <Select
                                label={t('materials.category') || 'Категория'}
                                value={selectedCategory}
                                onChange={(e) => setSelectedCategory(e.target.value)}
                                options={[
                                    { value: 'all', label: t('materials.filter.allCategories') || 'Все категории' },
                                    ...categories.map(cat => ({
                                        value: cat,
                                        label: cat === 'packaging_cardboard' 
                                            ? (t('materials.filter.packaging_cardboard') || 'Картонная упаковка')
                                            : cat
                                    }))
                                ]}
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm font-medium text-slate-400">
                            {t('production.totalStock') || 'Фактическое наличие'}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-slate-200">
                            {totals.stock.toLocaleString()}
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm font-medium text-slate-400">
                            {t('production.totalPlanned') || 'План расхода'}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-400">
                            {totals.planned.toLocaleString()}
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm font-medium text-slate-400">
                            {t('production.totalRequired') || 'Необходимо заказать'}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className={clsx(
                            "text-2xl font-bold",
                            totals.required > 0 ? "text-red-400" : "text-emerald-400"
                        )}>
                            {totals.required.toLocaleString()}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Planning Table */}
            <Card>
                <CardHeader>
                    <CardTitle>{t('production.materialsPlan') || 'План материалов'}</CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="text-center py-8 text-slate-400">
                            {t('common.loading') || 'Загрузка...'}
                        </div>
                    ) : planningData.length === 0 ? (
                        <div className="text-center py-8 text-slate-400">
                            {t('production.noData') || 'Нет данных для отображения'}
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="text-xs text-slate-400 uppercase bg-slate-900/50">
                                    <tr>
                                        <th className="px-4 py-3 text-left">{t('materials.code') || 'Артикул'}</th>
                                        <th className="px-4 py-3 text-left">{t('materials.name') || 'Наименование'}</th>
                                        <th className="px-4 py-3 text-right">{t('production.stock') || 'Наличие'}</th>
                                        <th className="px-4 py-3 text-right">{t('production.planned') || 'План'}</th>
                                        <th className="px-4 py-3 text-right">{t('production.required') || 'Необходимо'}</th>
                                        <th className="px-4 py-3 text-center">{t('production.status') || 'Статус'}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800">
                                    {planningData.map((data) => {
                                        const status = data.requiredOrder > 0 ? 'critical' : 
                                                      data.totalPlannedConsumption > data.totalStock ? 'warning' : 'ok';
                                        return (
                                            <tr key={data.item.id} className="hover:bg-slate-800/50">
                                                <td className="px-4 py-3 font-mono text-xs text-slate-400">
                                                    {data.item.code || data.item.sku || '-'}
                                                </td>
                                                <td className="px-4 py-3 text-slate-200">
                                                    {data.item.name}
                                                </td>
                                                <td className="px-4 py-3 text-right text-slate-300">
                                                    {data.totalStock.toLocaleString()} {data.item.unit || 'шт'}
                                                </td>
                                                <td className="px-4 py-3 text-right text-blue-400">
                                                    {data.totalPlannedConsumption.toLocaleString()} {data.item.unit || 'шт'}
                                                </td>
                                                <td className={clsx(
                                                    "px-4 py-3 text-right font-medium",
                                                    data.requiredOrder > 0 ? "text-red-400" : "text-slate-400"
                                                )}>
                                                    {data.requiredOrder > 0 
                                                        ? `${data.requiredOrder.toLocaleString()} ${data.item.unit || 'шт'}`
                                                        : '-'
                                                    }
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className={clsx(
                                                        "px-2 py-1 rounded text-xs font-medium",
                                                        status === 'critical' && "bg-red-900/30 text-red-400",
                                                        status === 'warning' && "bg-yellow-900/30 text-yellow-400",
                                                        status === 'ok' && "bg-emerald-900/30 text-emerald-400"
                                                    )}>
                                                        {status === 'critical' && (t('production.critical') || 'Критично')}
                                                        {status === 'warning' && (t('production.warning') || 'Внимание')}
                                                        {status === 'ok' && (t('production.ok') || 'ОК')}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Import Modal */}
            <ExcelImportModal
                isOpen={isImportModalOpen}
                onClose={handleImportClose}
            />
        </div>
    );
}

