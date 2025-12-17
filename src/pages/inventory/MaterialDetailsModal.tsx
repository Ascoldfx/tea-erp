import { useState, useEffect } from 'react';
import { Modal } from '../../components/ui/Modal';
import type { InventoryItem, StockLevel, Warehouse } from '../../types/inventory';
import { MOCK_WAREHOUSES } from '../../data/mockInventory';
import { History, Play, CheckCircle, Copy, Check } from 'lucide-react';
import { clsx } from 'clsx';
import { supabase } from '../../lib/supabase';
import { useLanguage } from '../../context/LanguageContext';

interface MaterialDetailsModalProps {
    item: (InventoryItem & { totalStock: number; stockLevels: StockLevel[] }) | null;
    isOpen: boolean;
    onClose: () => void;
    warehouses?: Warehouse[];
}

export default function MaterialDetailsModal({ item, isOpen, onClose, warehouses = [] }: MaterialDetailsModalProps) {
    const { t } = useLanguage();
    const [movementHistory, setMovementHistory] = useState<any[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (item && isOpen) {
            loadMovementHistory();
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

    const copyToClipboard = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    if (!item) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={item.name}>
            <div className="space-y-6">
                {/* Артикул для копирования */}
                <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700">
                    <div className="flex items-center justify-between">
                        <div>
                            <span className="text-slate-400 text-xs block mb-1">{t('materials.article') || 'Артикул'}</span>
                            <span className="text-sm font-mono font-semibold text-slate-200">{item.sku}</span>
                        </div>
                        <button
                            onClick={() => copyToClipboard(item.sku)}
                            className="flex items-center gap-2 px-2.5 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors text-slate-300 hover:text-slate-100 text-xs"
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
