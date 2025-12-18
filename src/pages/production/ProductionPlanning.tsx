import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { useInventory } from '../../hooks/useInventory';
import { useLanguage } from '../../context/LanguageContext';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { clsx } from 'clsx';
import type { InventoryItem, StockLevel } from '../../types/inventory';
import { supabase } from '../../lib/supabase';

interface PlanningDataItem {
    item: InventoryItem;
    totalStock: number;
    totalPlannedConsumption: number;
    plannedArrival: number; // Количество из открытых заказов
    actualArrival: number; // Фактический приход из доставленных заказов
    actualConsumption: number; // Фактический расход из stock_movements
    previousMonthDifference: number; // Остаток с предыдущего месяца
    difference: number; // Итоговая разница с учетом остатка и прихода (приоритет фактических данных)
    stockLevels: StockLevel[];
}

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
    
    // State for open orders (for planned arrival calculation)
    const [openOrders, setOpenOrders] = useState<Array<{
        id: string;
        item_id: string;
        quantity: number;
        received_quantity: number;
    }>>([]);
    
    // State for actual arrival (delivered orders for selected month)
    const [actualArrivals, setActualArrivals] = useState<Array<{
        item_id: string;
        quantity: number;
    }>>([]);
    
    // State for actual consumption (stock_movements type='out' for selected month)
    const [actualConsumptions, setActualConsumptions] = useState<Array<{
        item_id: string;
        quantity: number;
    }>>([]);

    // Force refresh when component mounts or when refreshKey changes
    useEffect(() => {
        refresh();
    }, [refreshKey]);
    
    // Fetch open orders (not delivered, not cancelled)
    useEffect(() => {
        const fetchOpenOrders = async () => {
            if (!supabase) return;
            
            try {
                // Get all open orders (draft, ordered, shipped)
                const { data: ordersData, error: ordersError } = await supabase
                    .from('orders')
                    .select('id, status')
                    .in('status', ['draft', 'ordered', 'shipped'])
                    .order('order_date', { ascending: false });
                
                if (ordersError) throw ordersError;
                
                if (!ordersData || ordersData.length === 0) {
                    setOpenOrders([]);
                    return;
                }
                
                // Get all order items for open orders
                const orderIds = ordersData.map(o => o.id);
                const { data: orderItems, error: itemsError } = await supabase
                    .from('order_items')
                    .select('id, order_id, item_id, quantity, received_quantity')
                    .in('order_id', orderIds);
                
                if (itemsError) throw itemsError;
                
                // Calculate pending quantity (quantity - received_quantity) for each item
                const itemsMap = new Map<string, number>();
                (orderItems || []).forEach(item => {
                    const pending = (item.quantity || 0) - (item.received_quantity || 0);
                    if (pending > 0) {
                        const current = itemsMap.get(item.item_id) || 0;
                        itemsMap.set(item.item_id, current + pending);
                    }
                });
                
                // Convert to array format
                const ordersArray = Array.from(itemsMap.entries()).map(([item_id, quantity]) => ({
                    id: '', // Not needed for our use case
                    item_id,
                    quantity,
                    received_quantity: 0
                }));
                
                setOpenOrders(ordersArray);
                console.log('[ProductionPlanning] Open orders items:', ordersArray.length);
            } catch (error) {
                console.error('[ProductionPlanning] Error fetching open orders:', error);
                setOpenOrders([]);
            }
        };
        
        fetchOpenOrders();
    }, [refreshKey]);
    
    // Fetch actual arrivals (delivered orders for selected month)
    useEffect(() => {
        const fetchActualArrivals = async () => {
            if (!supabase) return;
            
            try {
                const targetYearMonth = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;
                const monthStart = `${targetYearMonth}-01`;
                const monthEnd = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${new Date(selectedYear, selectedMonth + 1, 0).getDate()}`;
                
                // Get delivered orders for selected month
                const { data: ordersData, error: ordersError } = await supabase
                    .from('orders')
                    .select('id, order_date')
                    .eq('status', 'delivered')
                    .gte('order_date', monthStart)
                    .lte('order_date', monthEnd);
                
                if (ordersError) throw ordersError;
                
                if (!ordersData || ordersData.length === 0) {
                    setActualArrivals([]);
                    return;
                }
                
                // Get order items with received_quantity
                const orderIds = ordersData.map(o => o.id);
                const { data: orderItems, error: itemsError } = await supabase
                    .from('order_items')
                    .select('item_id, received_quantity')
                    .in('order_id', orderIds)
                    .gt('received_quantity', 0);
                
                if (itemsError) throw itemsError;
                
                // Sum received_quantity by item_id
                const itemsMap = new Map<string, number>();
                (orderItems || []).forEach(item => {
                    const received = item.received_quantity || 0;
                    if (received > 0) {
                        const current = itemsMap.get(item.item_id) || 0;
                        itemsMap.set(item.item_id, current + received);
                    }
                });
                
                const arrivalsArray = Array.from(itemsMap.entries()).map(([item_id, quantity]) => ({
                    item_id,
                    quantity
                }));
                
                setActualArrivals(arrivalsArray);
                console.log('[ProductionPlanning] Actual arrivals:', arrivalsArray.length);
            } catch (error) {
                console.error('[ProductionPlanning] Error fetching actual arrivals:', error);
                setActualArrivals([]);
            }
        };
        
        fetchActualArrivals();
    }, [selectedYear, selectedMonth, refreshKey]);
    
    // Fetch actual consumption (stock_movements type='out' for selected month)
    useEffect(() => {
        const fetchActualConsumption = async () => {
            if (!supabase) return;
            
            try {
                // Get stock movements with type='out' for selected month
                // Note: stock_movements uses 'created_at' or 'date' field - check actual schema
                const { data: movements, error: movementsError } = await supabase
                    .from('stock_movements')
                    .select('item_id, quantity, created_at')
                    .eq('type', 'out');
                
                // Filter by month in JavaScript since we're not sure of the exact date field name
                const filteredMovements = (movements || []).filter(movement => {
                    if (!movement.created_at) return false;
                    const movementDate = new Date(movement.created_at);
                    return movementDate.getFullYear() === selectedYear && movementDate.getMonth() === selectedMonth;
                });
                
                if (movementsError) throw movementsError;
                
                // Sum quantity by item_id
                const itemsMap = new Map<string, number>();
                filteredMovements.forEach(movement => {
                    const qty = movement.quantity || 0;
                    if (qty > 0) {
                        const current = itemsMap.get(movement.item_id) || 0;
                        itemsMap.set(movement.item_id, current + qty);
                    }
                });
                
                const consumptionsArray = Array.from(itemsMap.entries()).map(([item_id, quantity]) => ({
                    item_id,
                    quantity
                }));
                
                setActualConsumptions(consumptionsArray);
                console.log('[ProductionPlanning] Actual consumptions:', consumptionsArray.length);
            } catch (error) {
                console.error('[ProductionPlanning] Error fetching actual consumption:', error);
                setActualConsumptions([]);
            }
        };
        
        fetchActualConsumption();
    }, [selectedYear, selectedMonth, refreshKey]);

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
    const planningData = useMemo((): PlanningDataItem[] => {
        // Create a map of item SKU to item ID for faster lookup
        const skuToIdMap = new Map<string, string>();
        safeItems.forEach(item => {
            if (item.sku) {
                skuToIdMap.set(item.sku, item.id);
            }
        });

        // Create a map of planned arrival from open orders
        const plannedArrivalMap = new Map<string, number>();
        openOrders.forEach(order => {
            const current = plannedArrivalMap.get(order.item_id) || 0;
            plannedArrivalMap.set(order.item_id, current + order.quantity);
        });
        
        // Create a map of actual arrival from delivered orders
        const actualArrivalMap = new Map<string, number>();
        actualArrivals.forEach(arrival => {
            actualArrivalMap.set(arrival.item_id, arrival.quantity);
        });
        
        // Create a map of actual consumption from stock_movements
        const actualConsumptionMap = new Map<string, number>();
        actualConsumptions.forEach(consumption => {
            actualConsumptionMap.set(consumption.item_id, consumption.quantity);
        });

        // Calculate previous month
        const prevMonth = selectedMonth === 0 ? 11 : selectedMonth - 1;
        const prevYear = selectedMonth === 0 ? selectedYear - 1 : selectedYear;
        const prevYearMonth = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}`;

        return filteredItems.map(item => {
            // Get stock levels for this item
            const itemStock = safeStock.filter(s => s.itemId === item.id);
            const totalStock = itemStock.reduce((acc, curr) => acc + (curr.quantity || 0), 0);

            // Get planned consumption for this month
            // Build target month string for comparison (YYYY-MM format)
            const targetYearMonth = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;
            
            // Find planned consumption entries that match this item by UUID ONLY
            const matchingPlanned = safePlannedConsumption.filter(pc => {
                // Match by UUID only (item.id)
                const pcItemId = String(pc.itemId || '').trim();
                const itemIdStr = String(item.id || '').trim();
                
                if (pcItemId !== itemIdStr || !itemIdStr) {
                    return false;
                }
                
                // Filter by date - only entries for the selected month
                try {
                    const pcDateStr = String(pc.plannedDate || '').trim();
                    
                    // Check if date matches target month (YYYY-MM-01 or YYYY-MM-DD)
                    if (pcDateStr.startsWith(targetYearMonth)) {
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
            if (matchingPlanned.length > 0) {
                // Sort by date (most recent first) and take the first (most recent) value
                const sorted = matchingPlanned.sort((a, b) => {
                    const dateA = new Date(a.plannedDate).getTime();
                    const dateB = new Date(b.plannedDate).getTime();
                    return dateB - dateA; // Most recent first
                });
                totalPlannedConsumption = sorted[0].quantity || 0;
            }

            // Get planned arrival from open orders
            const plannedArrival = plannedArrivalMap.get(item.id) || 0;

            // Calculate previous month difference (remainder from previous month)
            // Find planned consumption for previous month
            const prevMonthPlanned = safePlannedConsumption.filter(pc => {
                const pcItemId = String(pc.itemId || '').trim();
                const itemIdStr = String(item.id || '').trim();
                
                if (pcItemId !== itemIdStr || !itemIdStr) {
                    return false;
                }
                
                try {
                    const pcDateStr = String(pc.plannedDate || '').trim();
                    if (pcDateStr.startsWith(prevYearMonth)) {
                        return true;
                    }
                    const pcDate = new Date(pcDateStr);
                    if (!isNaN(pcDate.getTime())) {
                        const pcYear = pcDate.getFullYear();
                        const pcMonth = pcDate.getMonth();
                        return pcYear === prevYear && pcMonth === prevMonth;
                    }
                    return false;
                } catch (e) {
                    return false;
                }
            });

            // Calculate previous month difference (remainder from previous month)
            // Current stock (totalStock) is the stock at the START of current month
            // This already reflects the result of previous month's operations:
            // - Stock at start of previous month
            // - Plus: planned arrivals during previous month
            // - Minus: planned consumption during previous month
            // 
            // So the remainder from previous month = current stock
            // (current stock already accounts for previous month's consumption)
            const previousMonthDifference = totalStock;

            // Calculate final difference with priority for actual data
            // Use actual arrival/consumption if available, otherwise use planned
            // Formula: (remainder from previous month + arrival) - consumption
            // Priority: actual > planned
            const finalArrival = actualArrival > 0 ? actualArrival : plannedArrival;
            const finalConsumption = actualConsumption > 0 ? actualConsumption : totalPlannedConsumption;
            const difference = previousMonthDifference + finalArrival - finalConsumption;

            return {
                item,
                totalStock,
                totalPlannedConsumption,
                plannedArrival,
                actualArrival,
                actualConsumption,
                previousMonthDifference,
                difference,
                stockLevels: itemStock
            };
        }).filter(() => 
            // Show all items for the selected category (even with 0 stock and 0 planned)
            true
        );
        
        // Sort by original order from database (preserve Excel import order)
        // Items are typically returned in creation order, which matches Excel import order
        // Create a map of item ID to index in original array to preserve order
        const itemOrderMap = new Map<string, number>();
        safeItems.forEach((item, index) => {
            itemOrderMap.set(item.id, index);
        });
        
        // Sort by original order (lower index = earlier in Excel)
        return planningData.sort((a: PlanningDataItem, b: PlanningDataItem) => {
            const orderA = itemOrderMap.get(a.item.id) ?? Infinity;
            const orderB = itemOrderMap.get(b.item.id) ?? Infinity;
            return orderA - orderB;
        });
    }, [filteredItems, safeStock, safePlannedConsumption, selectedYear, selectedMonth, safeItems, openOrders, actualArrivals, actualConsumptions]);


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
                                        <th className="px-4 py-3 text-right">{t('production.plannedArrival') || 'Планируемый приход'}</th>
                                        <th className="px-4 py-3 text-right">{t('production.actualArrival') || 'Фактический приход'}</th>
                                        <th className="px-4 py-3 text-right">{t('production.plannedConsumption') || 'планируемый расход'}</th>
                                        <th className="px-4 py-3 text-right">{t('production.actualConsumption') || 'Фактический расход'}</th>
                                        <th className="px-4 py-3 text-right">{t('production.difference') || 'Разница'}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800">
                                    {planningData.map((data: PlanningDataItem) => {
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
                                                <td className="px-4 py-3 text-right text-amber-400 whitespace-nowrap">
                                                    {data.plannedArrival > 0 
                                                        ? `${data.plannedArrival.toLocaleString()} ${data.item.unit || 'шт'}`
                                                        : '-'
                                                    }
                                                </td>
                                                <td className="px-4 py-3 text-right text-emerald-400 whitespace-nowrap font-medium">
                                                    {data.actualArrival > 0 
                                                        ? `${data.actualArrival.toLocaleString()} ${data.item.unit || 'шт'}`
                                                        : '-'
                                                    }
                                                </td>
                                                <td className="px-4 py-3 text-right text-blue-400 whitespace-nowrap">
                                                    {data.totalPlannedConsumption.toLocaleString()} {data.item.unit || 'шт'}
                                                </td>
                                                <td className="px-4 py-3 text-right text-orange-400 whitespace-nowrap font-medium">
                                                    {data.actualConsumption > 0 
                                                        ? `${data.actualConsumption.toLocaleString()} ${data.item.unit || 'шт'}`
                                                        : '-'
                                                    }
                                                </td>
                                                <td className={clsx(
                                                    "px-4 py-3 text-right font-medium whitespace-nowrap",
                                                    data.difference < 0 ? "text-red-400" : data.difference > 0 ? "text-green-400" : "text-slate-400"
                                                )}>
                                                    {data.difference !== 0 
                                                        ? `${data.difference > 0 ? '+' : ''}${data.difference.toLocaleString()} ${data.item.unit || 'шт'}`
                                                        : '0'
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

