import { useState } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import type { InventoryItem, StockLevel } from '../../types/inventory';
import { MOCK_ORDERS, MOCK_MOVEMENT_LOGS } from '../../data/mockProcurement';
import { MOCK_WAREHOUSES } from '../../data/mockInventory';
import { Truck, History, Play, CheckCircle } from 'lucide-react';
import { clsx } from 'clsx';

interface MaterialDetailsModalProps {
    item: (InventoryItem & { totalStock: number; stockLevels: StockLevel[] }) | null;
    isOpen: boolean;
    onClose: () => void;
}

export default function MaterialDetailsModal({ item, isOpen, onClose }: MaterialDetailsModalProps) {
    const [activeTab, setActiveTab] = useState<'history' | 'orders'>('history');
    const [newOrderQty, setNewOrderQty] = useState<number>(0);
    const [newOrderDate, setNewOrderDate] = useState<string>('');

    if (!item) return null;

    const history = MOCK_MOVEMENT_LOGS.filter(log => log.itemId === item.id);
    const orders = MOCK_ORDERS.filter(ord => ord.itemId === item.id);

    const handleOrder = (e: React.FormEvent) => {
        e.preventDefault();
        alert(`Заказ на ${newOrderQty} ${item.unit} материала "${item.name}" создан! ETA: ${newOrderDate}`);
        setNewOrderQty(0);
        setNewOrderDate('');
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Материал: ${item.name}`}>
            <div className="space-y-6">
                {/* Header Stats */}
                <div className="bg-slate-800 p-4 rounded-lg flex justify-between items-center text-slate-200">
                    <div>
                        <span className="text-slate-400 text-sm block">Общий остаток</span>
                        <span className="text-2xl font-bold">{item.totalStock} <span className="text-sm font-normal text-slate-500">{item.unit}</span></span>
                    </div>
                    <div className="text-right">
                        <span className="text-slate-400 text-sm block">Мин. остаток</span>
                        <span className="font-semibold">{item.minStockLevel} <span className="text-sm font-normal text-slate-500">{item.unit}</span></span>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-slate-700">
                    <button
                        className={clsx(
                            "px-4 py-2 text-sm font-medium transition-colors border-b-2",
                            activeTab === 'history' ? "border-emerald-500 text-emerald-400" : "border-transparent text-slate-400 hover:text-slate-200"
                        )}
                        onClick={() => setActiveTab('history')}
                    >
                        История движений
                    </button>
                    <button
                        className={clsx(
                            "px-4 py-2 text-sm font-medium transition-colors border-b-2",
                            activeTab === 'orders' ? "border-emerald-500 text-emerald-400" : "border-transparent text-slate-400 hover:text-slate-200"
                        )}
                        onClick={() => setActiveTab('orders')}
                    >
                        Закупки и Заказы
                    </button>
                </div>

                {/* Content */}
                <div className="min-h-[300px]">
                    {activeTab === 'history' && (
                        <div className="space-y-4">
                            <h4 className="text-sm font-medium text-slate-400 uppercase">Текущее размещение</h4>
                            <div className="grid grid-cols-2 gap-2">
                                {item.stockLevels.length > 0 ? item.stockLevels.map(stock => {
                                    const warehouse = MOCK_WAREHOUSES.find(w => w.id === stock.warehouseId);
                                    return (
                                        <div key={stock.id} className="bg-slate-800/50 p-3 rounded border border-slate-700">
                                            <p className="text-xs text-slate-400">{warehouse?.name || stock.warehouseId}</p>
                                            <p className="font-semibold text-slate-200">{stock.quantity} {item.unit}</p>
                                        </div>
                                    );
                                }) : (
                                    <p className="text-slate-500 text-sm col-span-2">Нет данных о размещении.</p>
                                )}
                            </div>

                            <h4 className="text-sm font-medium text-slate-400 uppercase mt-6">Журнал операций</h4>
                            <div className="space-y-3">
                                {history.length > 0 ? history.map(log => (
                                    <div key={log.id} className="flex justify-between items-center text-sm border-b border-slate-800 pb-2 last:border-0">
                                        <div className="flex items-center gap-3">
                                            <div className={clsx("p-2 rounded-full",
                                                log.type === 'in' ? "bg-emerald-900/40 text-emerald-400" :
                                                    log.type === 'out' ? "bg-red-900/40 text-red-400" :
                                                        "bg-blue-900/40 text-blue-400"
                                            )}>
                                                {log.type === 'in' ? <CheckCircle size={14} /> :
                                                    log.type === 'out' ? <Play size={14} className="rotate-180" /> : // visual hack for out
                                                        <History size={14} />}
                                            </div>
                                            <div>
                                                <p className="text-slate-300">
                                                    {log.type === 'in' ? 'Поступление' :
                                                        log.type === 'out' ? 'Списание' :
                                                            log.type === 'transfer' ? 'Перемещение' : 'Корректировка'}
                                                </p>
                                                <p className="text-xs text-slate-500">
                                                    {new Date(log.date).toLocaleDateString()} • {log.source ? `От: ${log.source}` : ''} {log.target ? `-> ${log.target}` : ''}
                                                </p>
                                            </div>
                                        </div>
                                        <p className="font-medium text-slate-200">
                                            {log.type === 'out' ? '-' : '+'}{log.quantity}
                                        </p>
                                    </div>
                                )) : (
                                    <p className="text-slate-500 italic text-center py-4">История движений пуста.</p>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'orders' && (
                        <div className="space-y-6">
                            {/* Order Form */}
                            <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700/50">
                                <h4 className="text-sm font-medium text-slate-200 mb-3">Сделать заказ поставщику</h4>
                                <form onSubmit={handleOrder} className="flex gap-3 items-end">
                                    <div className="flex-1">
                                        <Input
                                            label="Количество"
                                            type="number"
                                            placeholder="0"
                                            min="1"
                                            value={newOrderQty}
                                            onChange={(e) => setNewOrderQty(parseInt(e.target.value) || 0)}
                                            required
                                        />
                                    </div>
                                    <div className="flex-1">
                                        <Input
                                            label="Ожидаемая дата"
                                            type="date"
                                            value={newOrderDate}
                                            onChange={(e) => setNewOrderDate(e.target.value)}
                                            required
                                        />
                                    </div>
                                    <Button type="submit" variant="primary" className="bg-emerald-600 hover:bg-emerald-700">
                                        Заказать
                                    </Button>
                                </form>
                            </div>

                            {/* Active Orders List */}
                            <div>
                                <h4 className="text-sm font-medium text-slate-400 uppercase mb-3">Активные заказы (В пути)</h4>
                                <div className="space-y-3">
                                    {orders.length > 0 ? orders.map(order => (
                                        <div key={order.id} className="bg-slate-900 border border-slate-800 p-4 rounded flex justify-between items-center">
                                            <div className="flex items-center gap-4">
                                                <Truck className="text-blue-400" size={20} />
                                                <div>
                                                    <p className="text-slate-200 font-medium">Поставщик: {order.supplierName || 'Неизвестно'}</p>
                                                    <p className="text-xs text-slate-500">ETA: {new Date(order.estimatedArrival).toLocaleDateString()}</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="inline-flex items-center px-2 py-1 rounded bg-blue-900/30 text-blue-400 text-xs font-medium mb-1">
                                                    {order.status === 'ordered' ? 'Заказано' : 'Отгружено'}
                                                </div>
                                                <p className="text-slate-200 font-bold">{order.quantity} {item.unit}</p>
                                            </div>
                                        </div>
                                    )) : (
                                        <p className="text-slate-500 italic text-center py-4">Нет активных заказов.</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </Modal>
    );
}
