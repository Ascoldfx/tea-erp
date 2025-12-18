import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { useInventory } from '../../hooks/useInventory';
import { useLanguage } from '../../context/LanguageContext';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { clsx } from 'clsx';

// Production Planning Component
// Handles material consumption planning, stock levels, and required orders

export default function ProductionPlanning() {
    const { t, language } = useLanguage();
    const { items, stock, plannedConsumption, loading, refresh } = useInventory();
    
    // Debug: log planned consumption data
    useEffect(() => {
        if (plannedConsumption.length > 0) {
            console.log('[ProductionPlanning] Total planned consumption entries:', plannedConsumption.length);
            const decemberPlanned = plannedConsumption.filter(pc => {
                try {
                    const date = new Date(pc.plannedDate);
                    return date.getFullYear() === 2025 && date.getMonth() === 11; // December is month 11 (0-indexed)
                } catch {
                    return false;
                }
            });
            if (decemberPlanned.length > 0) {
                console.log('[ProductionPlanning] December 2025 planned consumption:', decemberPlanned);
            }
        }
    }, [plannedConsumption]);
    
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [selectedCategory, setSelectedCategory] = useState<string>('packaging_cardboard');
    const [refreshKey, setRefreshKey] = useState(0);

    // Force refresh when component mounts or when refreshKey changes
    useEffect(() => {
        refresh();
    }, [refreshKey]);

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
    // Note: We compare by year and month directly, not by date strings
    // This ensures accurate filtering of planned consumption data

    // Filter items by category
    const filteredItems = useMemo(() => {
        if (!Array.isArray(safeItems)) return [];
        if (selectedCategory === 'all') return safeItems;
        return safeItems.filter(item => item.category === selectedCategory);
    }, [safeItems, selectedCategory]);

    // Calculate planning data for each item
    const planningData = useMemo(() => {
        // Create a map of item SKU to item ID for faster lookup
        const skuToIdMap = new Map<string, string>();
        safeItems.forEach(item => {
            if (item.sku) {
                skuToIdMap.set(item.sku, item.id);
            }
        });

        return filteredItems.map(item => {
            // Get stock levels for this item
            const itemStock = safeStock.filter(s => s.itemId === item.id);
            const totalStock = itemStock.reduce((acc, curr) => acc + (curr.quantity || 0), 0);

            // Get planned consumption for this month
            // CRITICAL: itemId in planned_consumption might be either:
            // 1. item.id (UUID) - if item was found in database
            // 2. item.sku (code) - if item was not found and code was used as fallback
            // We need to check BOTH possibilities
            
            // Build target month string for comparison (YYYY-MM-01 format)
            const targetMonthStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-01`;
            
            // Find all planned consumption entries that match this item
            // CRITICAL: Check both item.id (UUID) and item.sku (code) because:
            // - New imports use UUID (item.id)
            // - Old imports might have used code (item.sku) as fallback
            const allMatchingPlanned = safePlannedConsumption.filter(pc => {
                const pcItemId = String(pc.itemId || '').trim();
                const itemIdStr = String(item.id || '').trim();
                const itemSkuStr = String(item.sku || '').trim();
                
                // Match by UUID (preferred)
                if (pcItemId === itemIdStr && itemIdStr) {
                    return true;
                }
                
                // Match by SKU (fallback for old data)
                if (pcItemId === itemSkuStr && itemSkuStr) {
                    return true;
                }
                
                return false;
            });
            
            // Debug: log if we found matches but they don't match by ID
            if (allMatchingPlanned.length > 0 && item.category === 'packaging_cardboard') {
                const matchedById = allMatchingPlanned.some(pc => String(pc.itemId) === String(item.id));
                const matchedBySku = allMatchingPlanned.some(pc => String(pc.itemId) === String(item.sku));
                if (!matchedById && matchedBySku) {
                    console.warn(`[ProductionPlanning] Item ${item.sku} matched by SKU (not UUID). This indicates old data format.`);
                }
            }

            // Filter by date - only entries for the selected month
            const monthMatchingPlanned = allMatchingPlanned.filter(pc => {
                try {
                    const pcDateStr = String(pc.plannedDate).trim();
                    
                    // Check if date matches target month (YYYY-MM-01 or YYYY-MM-DD)
                    if (pcDateStr.startsWith(targetMonthStr.substring(0, 7))) { // Compare YYYY-MM part
                        return true;
                    }
                    
                    // Also try parsing as Date object
                    const pcDate = new Date(pcDateStr);
                    if (!isNaN(pcDate.getTime())) {
                        const pcYear = pcDate.getFullYear();
                        const pcMonth = pcDate.getMonth();
                        return pcYear === selectedYear && pcMonth === selectedMonth;
                    }
                    
                    return false;
                } catch (e) {
                    return false;
                }
            });

            // IMPORTANT: If multiple entries exist for the same month, take the LAST one (most recent)
            // This prevents summing duplicates
            let totalPlannedConsumption = 0;
            if (monthMatchingPlanned.length > 0) {
                // Sort by date (most recent first) and take the first (most recent) value
                const sorted = monthMatchingPlanned.sort((a, b) => {
                    const dateA = new Date(a.plannedDate).getTime();
                    const dateB = new Date(b.plannedDate).getTime();
                    return dateB - dateA; // Most recent first
                });
                totalPlannedConsumption = sorted[0].quantity || 0;
                
                // Debug logging
                if (item.category === 'packaging_cardboard' && totalPlannedConsumption > 0) {
                    console.log(`[ProductionPlanning] Item ${item.sku} (id: ${item.id}): found ${totalPlannedConsumption} for ${targetMonthStr}`);
                    if (monthMatchingPlanned.length > 1) {
                        console.warn(`[ProductionPlanning] WARNING: Item ${item.sku} has ${monthMatchingPlanned.length} entries for ${targetMonthStr}, using most recent: ${totalPlannedConsumption}`);
                    }
                }
            }
            
            // Debug logging for items with no planned consumption
            if (item.category === 'packaging_cardboard' && totalPlannedConsumption === 0 && allMatchingPlanned.length > 0) {
                console.log(`[ProductionPlanning Debug] Item ${item.sku} (id: ${item.id}):`);
                console.log(`  - Total matching entries: ${allMatchingPlanned.length}`);
                console.log(`  - Entries:`, allMatchingPlanned.map(pc => `${pc.plannedDate}: ${pc.quantity} (itemId: ${pc.itemId})`));
                console.log(`  - Selected month: ${targetMonthStr}`);
                console.log(`  - Month matching entries: ${monthMatchingPlanned.length}`);
            }

            // Calculate required order (planned - stock, but not less than 0)
            const requiredOrder = Math.max(0, totalPlannedConsumption - totalStock);

            return {
                item,
                totalStock,
                totalPlannedConsumption,
                requiredOrder,
                stockLevels: itemStock
            };
        }).filter(() => 
            // Show all items for the selected category (even with 0 stock and 0 planned)
            true
        ).sort((a, b) => {
            // Sort by required order (descending), then by planned consumption
            if (b.requiredOrder !== a.requiredOrder) {
                return b.requiredOrder - a.requiredOrder;
            }
            return b.totalPlannedConsumption - a.totalPlannedConsumption;
        });
    }, [filteredItems, safeStock, safePlannedConsumption, selectedYear, selectedMonth, safeItems]);


    return (
        <div className="space-y-6 p-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">{t('production.planning') || 'Планирование'}</h1>
                    <p className="text-slate-400 mt-1">{t('production.planningDesc') || 'План расхода материалов, фактическое наличие и необходимый заказ'}</p>
                </div>
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
            </div>

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
                                    ...categories.map(cat => {
                                        // Get proper translation for category
                                        let label = cat;
                                        if (cat === 'packaging_cardboard') {
                                            label = t('materials.filter.packaging_cardboard') || 'Картонная упаковка';
                                        } else if (cat === 'tea_bulk') {
                                            label = t('materials.filter.teaBulk') || 'Чайная сировина';
                                        } else if (cat === 'flavor') {
                                            label = t('materials.filter.flavor') || 'Ароматизаторы';
                                        } else if (cat === 'packaging_consumable') {
                                            label = t('materials.filter.packaging') || 'Пленки';
                                        } else if (cat === 'soft_packaging') {
                                            label = t('materials.filter.softPackaging') || 'Мягкая упаковка';
                                        } else if (cat === 'packaging_crate') {
                                            label = t('materials.filter.crates') || 'Гофроящики';
                                        } else if (cat === 'label') {
                                            label = t('materials.filter.labels') || 'Ярлыки';
                                        } else if (cat === 'sticker') {
                                            label = t('materials.filter.stickers') || 'Стикеры';
                                        } else if (cat === 'envelope') {
                                            label = t('materials.filter.envelopes') || 'Конверты';
                                        } else if (cat === 'other') {
                                            label = t('materials.filter.other') || 'Другое';
                                        }
                                        return { value: cat, label };
                                    })
                                ]}
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

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
                                        <th className="px-4 py-3 text-right">{t('production.shortage') || 'Не хватает'}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800">
                                    {planningData.map((data) => {
                                        return (
                                            <tr key={data.item.id} className="hover:bg-slate-800/50">
                                                <td className="px-4 py-3 font-mono text-xs text-slate-400">
                                                    {data.item.sku || '-'}
                                                </td>
                                                <td className="px-4 py-3 text-slate-200 whitespace-nowrap">
                                                    <div className="max-w-md truncate" title={data.item.name}>
                                                        {data.item.name}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-right text-slate-300 whitespace-nowrap">
                                                    {data.totalStock.toLocaleString()} {data.item.unit || 'шт'}
                                                </td>
                                                <td className="px-4 py-3 text-right text-blue-400 whitespace-nowrap">
                                                    {data.totalPlannedConsumption.toLocaleString()} {data.item.unit || 'шт'}
                                                </td>
                                                <td className={clsx(
                                                    "px-4 py-3 text-right font-medium whitespace-nowrap",
                                                    data.requiredOrder > 0 ? "text-red-400" : "text-slate-400"
                                                )}>
                                                    {data.requiredOrder > 0 
                                                        ? `${data.requiredOrder.toLocaleString()} ${data.item.unit || 'шт'}`
                                                        : '-'
                                                    }
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

        </div>
    );
}

