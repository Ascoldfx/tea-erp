import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { useInventory } from '../../hooks/useInventory';
import { useLanguage } from '../../context/LanguageContext';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { clsx } from 'clsx';
import type { InventoryItem, StockLevel } from '../../types/inventory';
import { supabase } from '../../lib/supabase';
import MaterialDetailsModal from '../inventory/MaterialDetailsModal';

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
    const navigate = useNavigate();
    const { items, warehouses, stock, plannedConsumption, loading, refresh } = useInventory();

    // State for material details modal
    const [selectedItem, setSelectedItem] = useState<(InventoryItem & { totalStock: number; stockLevels: StockLevel[] }) | null>(null);
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

    // State for actual consumption (stock_movements type='out' for selected month)
    const [actualConsumptions, setActualConsumptions] = useState<Array<{
        item_id: string;
        quantity: number;
    }>>([]);

    // Добавляем логирование для отладки
    useEffect(() => {
        console.log('[ProductionPlanning] === ОТЛАДКА ПЛАНИРОВАНИЯ ===');
        console.log('[ProductionPlanning] Items:', items.length);
        console.log('[ProductionPlanning] Planned consumption entries:', plannedConsumption.length);
        console.log('[ProductionPlanning] Selected month:', selectedMonth + 1, selectedYear);
        console.log('[ProductionPlanning] Actual consumptions:', actualConsumptions.length);

        if (plannedConsumption.length > 0) {
            const targetYearMonth = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;
            const matching = plannedConsumption.filter(pc => {
                const dateStr = String(pc.plannedDate || '').trim();
                return dateStr.startsWith(targetYearMonth);
            });
            console.log(`[ProductionPlanning] Matching planned consumption for ${targetYearMonth}:`, matching.length);
            if (matching.length > 0) {
                console.log('[ProductionPlanning] Sample matching entries:', matching.slice(0, 5).map(pc => ({
                    itemId: pc.itemId,
                    date: pc.plannedDate,
                    quantity: pc.quantity,
                    itemSku: items.find(i => i.id === pc.itemId)?.sku || 'NOT FOUND'
                })));
            } else {
                // Показываем все доступные месяцы
                const allMonths = [...new Set(plannedConsumption.map(pc => {
                    const dateStr = String(pc.plannedDate || '').trim();
                    return dateStr.substring(0, 7); // YYYY-MM
                }))].sort();
                console.log('[ProductionPlanning] Available months in planned consumption:', allMonths);
            }
        }

        if (actualConsumptions.length > 0) {
            console.log('[ProductionPlanning] Sample actual consumptions:', actualConsumptions.slice(0, 5).map(ac => ({
                item_id: ac.item_id,
                quantity: ac.quantity,
                itemSku: items.find(i => i.id === ac.item_id)?.sku || 'NOT FOUND'
            })));
        }
    }, [items.length, plannedConsumption.length, actualConsumptions.length, selectedMonth, selectedYear]);

    // Debug: log planned consumption data
    useEffect(() => {
        console.log('[ProductionPlanning] Planned consumption data updated:', {
            totalEntries: plannedConsumption.length,
            selectedMonth: selectedMonth + 1,
            selectedYear: selectedYear,
            sampleEntries: plannedConsumption.slice(0, 5)
        });

        if (plannedConsumption.length > 0) {
            // Log entries for selected month
            const targetYearMonth = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;
            const matchingEntries = plannedConsumption.filter(pc => {
                try {
                    const pcDateStr = String(pc.plannedDate || '').trim();
                    return pcDateStr.startsWith(targetYearMonth);
                } catch {
                    return false;
                }
            });
            console.log(`[ProductionPlanning] Entries for ${targetYearMonth}:`, matchingEntries.length);
            if (matchingEntries.length > 0) {
                console.log('[ProductionPlanning] Sample matching entries:', matchingEntries.slice(0, 3));
            } else {
                console.warn('[ProductionPlanning] No matching entries found for selected month!');
                // Log all unique months in planned consumption
                const allMonths = [...new Set(plannedConsumption.map(pc => {
                    const dateStr = String(pc.plannedDate || '').trim();
                    return dateStr.substring(0, 7); // YYYY-MM
                }))].sort();
                console.log('[ProductionPlanning] Available months in data:', allMonths);
            }
        } else {
            console.warn('[ProductionPlanning] No planned consumption data loaded!');
        }
    }, [plannedConsumption, selectedMonth, selectedYear]);
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

    // Force refresh when component mounts or when refreshKey changes
    useEffect(() => {
        refresh();
    }, [refreshKey]);

    // Listen for storage events to refresh when data is imported from another tab
    useEffect(() => {
        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === 'inventory_updated' || e.key === 'planned_consumption_updated') {
                console.log('[ProductionPlanning] Storage event detected, refreshing data...');
                refresh();
            }
        };
        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, [refresh]);

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
                // Check both 'date' and 'created_at' fields
                const { data: movements, error: movementsError } = await supabase
                    .from('stock_movements')
                    .select('item_id, quantity, created_at')
                    .eq('type', 'out');

                if (movementsError) throw movementsError;

                // Filter by month - use 'created_at' field
                // Filter by month using robust string matching
                const targetPrefix = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;

                const filteredMovements = (movements || []).filter(movement => {
                    // Use 'created_at' field (which stores the date for imported actual consumption)
                    if (movement.created_at) {
                        // Check strictly by string prefix to avoid timezone issues
                        if (movement.created_at.startsWith(targetPrefix)) {
                            return true;
                        }

                        // Fallback check using Date object just in case format differs
                        try {
                            const d = new Date(movement.created_at);
                            const y = d.getFullYear();
                            const m = d.getMonth(); // 0-11
                            return y === selectedYear && m === selectedMonth;
                        } catch (e) {
                            return false;
                        }
                    }

                    return false;
                });

                console.log(`[ProductionPlanning] Filtered ${filteredMovements.length} actual consumption movements for ${selectedYear}-${selectedMonth + 1} from ${movements?.length || 0} total`);

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

    // Function to shorten material names in the list (same logic as InventoryList)
    const shortenMaterialName = (name: string): string => {
        let shortened = name;
        // Remove common packaging prefixes (order matters - check longer prefixes first)
        const prefixesToRemove = [
            'Картонна упаковка на чай ',
            'Картонная упаковка на чай ',
            'Коробка для чаю ',
            'Коробка для чая ',
            'Упаковка для чая ',
            'Упаковка для чаю ',
            'Упаковка на чай ',
            'Картонна упаковка на чай',
            'Картонная упаковка на чай',
            'Коробка для чаю',
            'Коробка для чая',
            'Упаковка для чая',
            'Упаковка для чаю',
            'Упаковка на чай'
        ];

        for (const prefix of prefixesToRemove) {
            // Check if name starts with prefix (case-insensitive)
            if (shortened.toLowerCase().startsWith(prefix.toLowerCase())) {
                // Remove the prefix - use the length of the matched prefix from original string
                const matchedLength = prefix.length;
                shortened = shortened.substring(matchedLength);
                break;
            }
        }

        return shortened.trim();
    };

    // Handle item click to open details modal
    const handleItemClick = (data: PlanningDataItem) => {
        const itemWithStock = {
            ...data.item,
            totalStock: data.totalStock,
            stockLevels: data.stockLevels
        };
        setSelectedItem(itemWithStock);
        setIsDetailsModalOpen(true);
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
                console.log(`[ProductionPlanning] Item ${item.sku} (${item.id}): planned consumption = ${totalPlannedConsumption} for ${targetYearMonth}`);
            } else {
                // Проверяем, есть ли вообще planned consumption для этого item
                const allForItem = safePlannedConsumption.filter(pc => {
                    const pcItemId = String(pc.itemId || '').trim();
                    const itemIdStr = String(item.id || '').trim();
                    return pcItemId === itemIdStr && itemIdStr;
                });
                if (allForItem.length > 0) {
                    console.warn(`[ProductionPlanning] Item ${item.sku} (${item.id}): есть ${allForItem.length} записей planned consumption, но не для месяца ${targetYearMonth}`);
                    console.warn(`[ProductionPlanning] Доступные месяцы для этого item:`, [...new Set(allForItem.map(pc => {
                        const dateStr = String(pc.plannedDate || '').trim();
                        return dateStr.substring(0, 7);
                    }))]);
                } else {
                    console.log(`[ProductionPlanning] Item ${item.sku} (${item.id}): NO planned consumption вообще`);
                }
            }

            // Get planned arrival from open orders
            const plannedArrival = plannedArrivalMap.get(item.id) || 0;

            // Get actual arrival from delivered orders (priority over planned)
            const actualArrival = actualArrivalMap.get(item.id) || 0;

            // Get actual consumption from stock_movements (priority over planned)
            const actualConsumption = actualConsumptionMap.get(item.id) || 0;

            if (actualConsumption > 0) {
                console.log(`[ProductionPlanning] Item ${item.sku} (${item.id}): actual consumption = ${actualConsumption} for ${targetYearMonth}`);
            }

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
        }).filter((data: PlanningDataItem) => {
            // Определяем, является ли выбранный месяц прошедшим
            const now = new Date();
            const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            const selectedMonthDate = new Date(selectedYear, selectedMonth, 1);
            const isPastMonth = selectedMonthDate < currentMonth;

            // Для прошедших месяцев: скрывать материалы с 0 фактическим расходом, 0 остатком и 0 фактическим приходом
            if (isPastMonth) {
                return data.actualConsumption > 0 || data.totalStock > 0 || data.actualArrival > 0;
            }

            // Для текущего и будущих месяцев: скрывать материалы с 0 планируемым расходом, 0 остатком, 0 плановым приходом и 0 фактическим приходом
            return data.totalPlannedConsumption > 0 || data.totalStock > 0 || data.plannedArrival > 0 || data.actualArrival > 0;
        });

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
                <div className="flex gap-3">
                    <Button
                        variant="outline"
                        onClick={() => navigate('/production/schedule')}
                        className="border-slate-600 hover:bg-slate-800"
                    >
                        {/* TODO: Add proper icon import */}
                        {t('production.weeklySchedule') || 'Недельный план / Факт'}
                    </Button>
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
                                            <tr key={data.item.id} className="hover:bg-slate-800/50 group">
                                                <td
                                                    className="px-4 py-3 font-mono text-xs text-slate-400 cursor-pointer"
                                                    onDoubleClick={() => handleItemClick(data)}
                                                >
                                                    {data.item.sku || '-'}
                                                </td>
                                                <td
                                                    className="px-4 py-3 text-slate-200 whitespace-nowrap cursor-pointer group-hover:text-emerald-400 transition-colors"
                                                    onDoubleClick={() => handleItemClick(data)}
                                                >
                                                    <div className="max-w-md truncate" title={data.item.name}>
                                                        {shortenMaterialName(data.item.name)}
                                                    </div>
                                                </td>
                                                <td
                                                    className="px-4 py-3 text-right text-slate-300 whitespace-nowrap cursor-pointer"
                                                    onDoubleClick={() => handleItemClick(data)}
                                                >
                                                    {data.totalStock.toLocaleString()} {data.item.unit || 'шт'}
                                                </td>
                                                <td
                                                    className="px-4 py-3 text-right text-amber-400 whitespace-nowrap cursor-pointer"
                                                    onDoubleClick={() => handleItemClick(data)}
                                                >
                                                    {data.plannedArrival > 0
                                                        ? `${data.plannedArrival.toLocaleString()} ${data.item.unit || 'шт'}`
                                                        : '-'
                                                    }
                                                </td>
                                                <td
                                                    className="px-4 py-3 text-right text-emerald-400 whitespace-nowrap font-medium cursor-pointer"
                                                    onDoubleClick={() => handleItemClick(data)}
                                                >
                                                    {data.actualArrival > 0
                                                        ? `${data.actualArrival.toLocaleString()} ${data.item.unit || 'шт'}`
                                                        : '-'
                                                    }
                                                </td>
                                                <td
                                                    className="px-4 py-3 text-right text-blue-400 whitespace-nowrap cursor-pointer"
                                                    onDoubleClick={() => handleItemClick(data)}
                                                >
                                                    {data.totalPlannedConsumption.toLocaleString()} {data.item.unit || 'шт'}
                                                </td>
                                                <td
                                                    className="px-4 py-3 text-right text-orange-400 whitespace-nowrap font-medium cursor-pointer"
                                                    onDoubleClick={() => handleItemClick(data)}
                                                >
                                                    {data.actualConsumption > 0
                                                        ? `${data.actualConsumption.toLocaleString()} ${data.item.unit || 'шт'}`
                                                        : '-'
                                                    }
                                                </td>
                                                <td
                                                    className={clsx(
                                                        "px-4 py-3 text-right font-medium whitespace-nowrap cursor-pointer",
                                                        data.difference < 0 ? "text-red-400" : data.difference > 0 ? "text-green-400" : "text-slate-400"
                                                    )}
                                                    onDoubleClick={() => handleItemClick(data)}
                                                >
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

            {/* Material Details Modal */}
            <MaterialDetailsModal
                isOpen={isDetailsModalOpen}
                onClose={() => setIsDetailsModalOpen(false)}
                item={selectedItem}
                warehouses={warehouses}
            />

        </div>
    );
}


