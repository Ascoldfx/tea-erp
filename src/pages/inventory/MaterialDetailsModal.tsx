import { useState, useEffect, useMemo } from 'react';
import { Modal } from '../../components/ui/Modal';
import type { InventoryItem, StockLevel, Warehouse } from '../../types/inventory';
import { MOCK_WAREHOUSES } from '../../data/mockInventory';
import { History, Play, CheckCircle, Copy, Check, Package } from 'lucide-react';
import { clsx } from 'clsx';
import { supabase } from '../../lib/supabase';
import { useLanguage } from '../../context/LanguageContext';
import { MOCK_RECIPES } from '../../data/mockProduction';
import { inventoryService } from '../../services/inventoryService';
import { useInventory } from '../../hooks/useInventory';

interface MaterialDetailsModalProps {
    item: (InventoryItem & { totalStock: number; stockLevels: StockLevel[] }) | null;
    isOpen: boolean;
    onClose: () => void;
    warehouses?: Warehouse[];
}

export default function MaterialDetailsModal({ item, isOpen, onClose, warehouses = [] }: MaterialDetailsModalProps) {
    const { t } = useLanguage();
    const { items: allItems } = useInventory();
    const [movementHistory, setMovementHistory] = useState<any[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [copied, setCopied] = useState(false);
    const [plannedConsumption, setPlannedConsumption] = useState<any[]>([]);
    const [loadingPlanned, setLoadingPlanned] = useState(false);

    useEffect(() => {
        if (item && isOpen) {
            loadMovementHistory();
            loadPlannedConsumption();
        }
    }, [item, isOpen]);

    const loadMovementHistory = async () => {
        if (!item || !supabase) return;
        setLoadingHistory(true);

        const { data, error } = await supabase
            .from('stock_movements')
            .select('*')
            .eq('item_id', item.id)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error loading movement history:', error);
        } else {
            setMovementHistory(data || []);
        }
        setLoadingHistory(false);
    };

    const loadPlannedConsumption = async () => {
        if (!item) return;
        setLoadingPlanned(true);
        try {
            // Fetch directly from service
            const data = await inventoryService.getPlannedConsumption(item.id);
            // Filter only future/planned items if needed, or show all
            setPlannedConsumption(data || []);
        } catch (error) {
            console.error('Error loading planned consumption:', error);
        } finally {
            setLoadingPlanned(false);
        }
    };

    const copyToClipboard = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    // Find finished goods (SKU) that use this material
    const finishedGoodsUsingMaterial = useMemo(() => {
        if (!item) return [];

        // Find recipes that use this material
        const recipesUsingMaterial = MOCK_RECIPES.filter(recipe =>
            recipe.ingredients.some(ing => ing.itemId === item.id)
        );

        // Get unique finished goods from these recipes
        const finishedGoodsMap = new Map<string, {
            recipeName: string;
            sku: string;
            name: string;
            quantity: number; // Normalized quantity per output
        }>();

        recipesUsingMaterial.forEach(recipe => {
            const ingredient = recipe.ingredients.find(ing => ing.itemId === item.id);
            if (!ingredient) return;

            const finishedGood = allItems.find(i => i.id === recipe.outputItemId);
            const sku = finishedGood?.sku || recipe.outputItemId;
            const name = finishedGood?.name || recipe.name;

            // Use existing entry or create new
            const key = sku;
            if (!finishedGoodsMap.has(key)) {
                finishedGoodsMap.set(key, {
                    recipeName: recipe.name,
                    sku,
                    name,
                    quantity: ingredient.quantity
                });
            }
        });

        return Array.from(finishedGoodsMap.values());
    }, [item, allItems]);

    if (!item) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={item.name}>
            <div className="space-y-6">
                {/* Артикул для копирования - одна строка */}
                <div className="bg-slate-800/50 px-3 py-2 rounded-lg border border-slate-700">
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span className="text-slate-400 text-xs whitespace-nowrap">{t('materials.article') || 'Артикул'}:</span>
                            <span className="text-sm font-mono font-semibold text-slate-200 truncate">{item.sku}</span>
                        </div>
                        <button
                            onClick={() => copyToClipboard(item.sku)}
                            className="flex items-center gap-1.5 px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors text-slate-300 hover:text-slate-100 text-xs flex-shrink-0"
                            title={t('materials.copy') || 'Копировать'}
                        >
                            {copied ? (
                                <>
                                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                                    <span className="text-emerald-400">{t('materials.copied') || 'Скопировано'}</span>
                                </>
                            ) : (
                                <>
                                    <Copy className="w-3.5 h-3.5" />
                                    <span>{t('materials.copy') || 'Копировать'}</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Header Stats */}
                <div className="bg-slate-800 p-4 rounded-lg text-slate-200">
                    <span className="text-slate-400 text-sm block">Общий остаток</span>
                    <span className="text-2xl font-bold">{item.totalStock} <span className="text-sm font-normal text-slate-500">{item.unit === 'pcs' ? 'шт' : item.unit}</span></span>
                </div>

                {/* Tab Header */}
                <div className="flex border-b border-slate-700">
                    <div className="px-4 py-2 text-sm font-medium transition-colors border-b-2 border-emerald-500 text-emerald-400">
                        Поступления и перемещения
                    </div>
                </div>

                {/* Content */}
                <div className="min-h-[300px]">
                    <div className="space-y-4">
                        <h4 className="text-sm font-medium text-slate-400 uppercase">Текущее размещение</h4>
                        <div className="grid grid-cols-2 gap-2">
                            {item.stockLevels.length > 0 ? item.stockLevels.map(stock => {
                                // Get warehouse from the warehouses list passed from parent
                                const warehouse = (warehouses.length > 0 ? warehouses : MOCK_WAREHOUSES).find((w: Warehouse) => w.id === stock.warehouseId);
                                return (
                                    <div key={stock.id} className="bg-slate-800/50 p-3 rounded border border-slate-700">
                                        <p className="text-xs text-slate-400">{warehouse?.name || stock.warehouseId}</p>
                                        <p className="font-semibold text-slate-200">{stock.quantity} {item.unit === 'pcs' ? 'шт' : item.unit}</p>
                                    </div>
                                );
                            }) : (
                                <p className="text-slate-500 text-sm col-span-2">Нет данных о размещении.</p>
                            )}
                        </div>

                        {/* Planned Consumption Section */}
                        {(plannedConsumption.length > 0 || loadingPlanned) && (
                            <>
                                <h4 className="text-sm font-medium text-slate-400 uppercase mt-6 flex items-center gap-2">
                                    <History className="w-4 h-4" />
                                    {t('materials.plannedConsumption') || 'Плановый расход'}
                                </h4>
                                {loadingPlanned ? (
                                    <p className="text-slate-500 text-sm italic">Загрузка плана...</p>
                                ) : (
                                    <div className="space-y-2">
                                        {plannedConsumption.map((plan, idx) => (
                                            <div key={plan.id || idx} className="bg-blue-900/10 p-3 rounded-lg border border-blue-900/30 flex justify-between items-center">
                                                <div>
                                                    <p className="text-slate-200 text-sm font-medium">
                                                        {new Date(plan.plannedDate).toLocaleDateString(t('common.locale') || 'ru-RU', { month: 'long', year: 'numeric' })}
                                                    </p>
                                                    <p className="text-xs text-slate-500 mt-1">{plan.notes || 'План из Excel'}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-sm font-bold text-blue-400">
                                                        {plan.quantity} {item.unit === 'pcs' ? 'шт' : item.unit}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}

                        {/* Finished Goods Using This Material */}
                        {finishedGoodsUsingMaterial.length > 0 && (
                            <>
                                <h4 className="text-sm font-medium text-slate-400 uppercase mt-6 flex items-center gap-2">
                                    <Package className="w-4 h-4" />
                                    {t('materials.usedInProducts') || 'Используется в готовой продукции'}
                                </h4>
                                <div className="space-y-2">
                                    {finishedGoodsUsingMaterial.map((fg, idx) => (
                                        <div key={idx} className="bg-slate-800/50 p-3 rounded-lg border border-slate-700">
                                            <div className="flex items-start justify-between">
                                                <div className="flex-1">
                                                    <p className="text-slate-200 text-sm font-medium">{fg.name}</p>
                                                    <p className="text-xs text-slate-400 mt-1 font-mono">{fg.sku}</p>
                                                    <p className="text-xs text-slate-500 mt-1 italic">
                                                        {t('materials.techCard') || 'Техкарта'}: {fg.recipeName}
                                                    </p>
                                                </div>
                                                <div className="text-right ml-3">
                                                    <p className="text-xs text-slate-400">
                                                        {t('materials.norm') || 'Норма'}: {fg.quantity} {item.unit === 'pcs' ? 'шт' : item.unit}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}

                        <h4 className="text-sm font-medium text-slate-400 uppercase mt-6">Журнал операций</h4>
                        <div className="space-y-3">
                            {loadingHistory ? (
                                <p className="text-slate-500 text-sm text-center py-4">Загрузка...</p>
                            ) : movementHistory.length > 0 ? movementHistory.map(log => (
                                <div key={log.id} className="flex justify-between items-center text-sm border-b border-slate-800 pb-2 last:border-0">
                                    <div className="flex items-center gap-3">
                                        <div className={clsx("p-2 rounded-full",
                                            log.type === 'in' ? "bg-emerald-900/40 text-emerald-400" :
                                                log.type === 'out' ? "bg-red-900/40 text-red-400" :
                                                    "bg-blue-900/40 text-blue-400"
                                        )}>
                                            {log.type === 'in' ? <CheckCircle size={14} /> :
                                                log.type === 'out' ? <Play size={14} /> :
                                                    <History size={14} />}
                                        </div>
                                        <div>
                                            <p className="text-slate-200 font-medium">
                                                {log.type === 'in' ? 'Поступление' :
                                                    log.type === 'out' ? 'Расход' : 'Перемещение'}
                                            </p>
                                            <p className="text-xs text-slate-500">{log.comment || 'Без комментария'}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className={clsx("font-semibold",
                                            log.type === 'in' ? "text-emerald-400" : "text-red-400"
                                        )}>
                                            {log.type === 'in' ? '+' : '-'}{log.quantity} {item.unit}
                                        </p>
                                        <p className="text-xs text-slate-500">
                                            {log.created_at ? new Date(log.created_at).toLocaleDateString('ru-RU') : ''}
                                        </p>
                                    </div>
                                </div>
                            )) : (
                                <p className="text-slate-500 text-sm text-center italic py-8">История движений пуста.</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </Modal>
    );
}
