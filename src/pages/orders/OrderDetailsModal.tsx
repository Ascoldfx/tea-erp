import { useState, useEffect } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { ordersService, type OrderWithItems } from '../../services/ordersService';
import { MOCK_WAREHOUSES } from '../../data/mockInventory';
import { Loader2, XCircle, Truck, Package } from 'lucide-react';

interface OrderDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    orderId: string;
    onOrderUpdated?: () => void;
}

export default function OrderDetailsModal({ isOpen, onClose, orderId, onOrderUpdated }: OrderDetailsModalProps) {
    const [order, setOrder] = useState<OrderWithItems | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [receivedQuantities, setReceivedQuantities] = useState<Record<string, number | string>>({});
    const [selectedWarehouse, setSelectedWarehouse] = useState('wh-main');
    const [showWarehouseSelector, setShowWarehouseSelector] = useState(false);

    useEffect(() => {
        if (isOpen && orderId) {
            loadOrder();
        }
    }, [isOpen, orderId]);

    const loadOrder = async () => {
        setLoading(true);
        const data = await ordersService.getOrderWithItems(orderId);
        if (data) {
            setOrder(data);
            // Initialize received quantities
            const quantities: Record<string, number | string> = {};
            data.items.forEach(item => {
                quantities[item.id] = item.received_quantity || 0;
            });
            setReceivedQuantities(quantities);
        }
        setLoading(false);
    };

    const handleStatusChange = async (newStatus: string) => {
        if (!order) return;

        // If changing to delivered, show warehouse selector
        if (newStatus === 'delivered') {
            setShowWarehouseSelector(true);
            return;
        }

        setSaving(true);
        const success = await ordersService.updateOrderStatus(order.id, newStatus);
        if (success) {
            await loadOrder();
            onOrderUpdated?.();
        }
        setSaving(false);
    };

    const handleReceiveOrder = async () => {
        if (!order) return;
        setSaving(true);

        // First save received quantities
        const updates = order.items.map(item => ({
            id: item.id,
            received_quantity: Number(receivedQuantities[item.id] || 0)
        }));
        await ordersService.updateReceivedQuantities(updates);

        // Then receive order (updates stock + creates movements)
        const success = await ordersService.receiveOrder(order.id, selectedWarehouse);
        if (success) {
            alert('Заказ принят! Остатки обновлены.');
            setShowWarehouseSelector(false);
            await loadOrder();
            onOrderUpdated?.();
        } else {
            alert('Ошибка при приёме заказа');
        }
        setSaving(false);
    };

    const handleSaveReceivedQuantities = async () => {
        if (!order) return;
        setSaving(true);

        const updates = order.items.map(item => ({
            id: item.id,
            received_quantity: Number(receivedQuantities[item.id] || 0)
        }));

        const success = await ordersService.updateReceivedQuantities(updates);
        if (success) {
            alert('Фактическое количество сохранено');
            await loadOrder();
            onOrderUpdated?.();
        } else {
            alert('Ошибка при сохранении');
        }
        setSaving(false);
    };

    const handleCancel = async () => {
        if (!order) return;
        if (confirm('Отменить заказ?')) {
            setSaving(true);
            const success = await ordersService.cancelOrder(order.id);
            if (success) {
                await loadOrder();
                onOrderUpdated?.();
            }
            setSaving(false);
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'ordered': return <Clock className="w-5 h-5" />;
            case 'shipped': return <Truck className="w-5 h-5" />;
            case 'delivered': return <CheckCircle className="w-5 h-5" />;
            case 'cancelled': return <XCircle className="w-5 h-5" />;
            default: return <Package className="w-5 h-5" />;
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'ordered': return 'text-blue-400 bg-blue-900/30';
            case 'shipped': return 'text-amber-400 bg-amber-900/30';
            case 'delivered': return 'text-emerald-400 bg-emerald-900/30';
            case 'cancelled': return 'text-red-400 bg-red-900/30';
            default: return 'text-slate-400 bg-slate-800';
        }
    };

    const getStatusLabel = (status: string) => {
        const map: Record<string, string> = {
            draft: 'Черновик',
            ordered: 'Заказано',
            shipped: 'В пути',
            delivered: 'Доставлено',
            cancelled: 'Отменено'
        };
        return map[status] || status;
    };

    const canEditQuantities = order?.status === 'delivered' || order?.status === 'shipped';

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Детали заказа">
            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
                </div>
            ) : order ? (
                <div className="space-y-6">
                    {/* Header Info */}
                    <div className="bg-slate-900 p-4 rounded-lg border border-slate-800">
                        <div className="flex items-center justify-between mb-3">
                            <div>
                                <h3 className="text-lg font-medium text-slate-200">
                                    {order.contractor?.name || 'Неизвестный поставщик'}
                                </h3>
                                <p className="text-sm text-slate-400">
                                    Дата заказа: {new Date(order.order_date).toLocaleDateString()}
                                </p>
                            </div>
                            <div className={clsx('px-3 py-2 rounded-lg flex items-center gap-2', getStatusColor(order.status))}>
                                {getStatusIcon(order.status)}
                                <span className="font-medium">{getStatusLabel(order.status)}</span>
                            </div>
                        </div>
                        <div className="text-2xl font-bold text-emerald-400">
                            {order.total_amount.toLocaleString()} ₴
                        </div>
                    </div>

                    {/* Warehouse Selector for Receiving Order */}
                    {showWarehouseSelector && order.status === 'shipped' && (
                        <div className="bg-blue-900/20 border border-blue-800 p-4 rounded-lg">
                            <div className="flex items-center gap-2 mb-3">
                                <Warehouse className="w-5 h-5 text-blue-400" />
                                <h4 className="font-medium text-blue-300">Выберите склад для приёма</h4>
                            </div>
                            <div className="flex gap-3 items-end">
                                <div className="flex-1">
                                    <Select
                                        label="Склад назначения"
                                        value={selectedWarehouse}
                                        onChange={(e) => setSelectedWarehouse(e.target.value)}
                                        options={[
                                            { value: 'wh-main', label: 'Главный склад' },
                                            { value: 'wh-prod-1', label: 'Склад Подрядчика' },
                                            { value: 'wh-contractor', label: 'Цех (ИМА С23 #1)' }
                                        ]}
                                    />
                                </div>
                                <Button
                                    onClick={handleReceiveOrder}
                                    disabled={saving}
                                    className="bg-emerald-600 hover:bg-emerald-700"
                                >
                                    {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                    Принять заказ
                                </Button>
                                <Button
                                    variant="ghost"
                                    onClick={() => setShowWarehouseSelector(false)}
                                    disabled={saving}
                                >
                                    Отмена
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Order Items */}
                    <div>
                        <h4 className="text-sm font-medium text-slate-300 mb-3">Состав заказа</h4>
                        <div className="space-y-2">
                            {order.items.map(item => {
                                const displayQty = order.status === 'delivered' && item.received_quantity > 0
                                    ? item.received_quantity
                                    : item.quantity;

                                return (
                                    <div key={item.id} className="bg-slate-900 p-3 rounded-lg border border-slate-800">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex-1">
                                                <div className="font-medium text-slate-200">
                                                    {item.item?.name || 'Unknown Item'}
                                                </div>
                                                <div className="text-xs text-slate-500">
                                                    {item.item?.sku} • {item.price_per_unit} ₴/{item.item?.unit || 'шт'}
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-slate-300">
                                                    {order.status === 'delivered' && item.received_quantity > 0 ? (
                                                        <>Получено: <span className="font-bold text-emerald-400">{displayQty}</span> {item.item?.unit || 'шт'}</>
                                                    ) : (
                                                        <>Заказано: <span className="font-bold">{displayQty}</span> {item.item?.unit || 'шт'}</>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {canEditQuantities && (
                                            <div className="mt-2 pt-2 border-t border-slate-700">
                                                <Input
                                                    label="Фактически получено"
                                                    type="number"
                                                    min="0"
                                                    value={receivedQuantities[item.id]}
                                                    onChange={e => setReceivedQuantities({
                                                        ...receivedQuantities,
                                                        [item.id]: e.target.value === '' ? '' : Number(e.target.value)
                                                    })}
                                                />
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex justify-between gap-3 pt-4 border-t border-slate-800">
                        <div className="flex gap-2">
                            {order.status !== 'cancelled' && order.status !== 'delivered' && (
                                <Button
                                    variant="ghost"
                                    onClick={handleCancel}
                                    disabled={saving}
                                    className="text-red-400 hover:text-red-300"
                                >
                                    <XCircle className="w-4 h-4 mr-2" />
                                    Отменить заказ
                                </Button>
                            )}
                        </div>

                        <div className="flex gap-3 items-end">
                            {order.status === 'ordered' && (
                                <Button
                                    onClick={() => handleStatusChange('shipped')}
                                    disabled={saving}
                                    className="bg-amber-600 hover:bg-amber-700"
                                >
                                    <Truck className="w-4 h-4 mr-2" />
                                    Отправлен в путь
                                </Button>
                            )}

                            {order.status === 'shipped' && (
                                <>
                                    <Select
                                        label="Склад для приёмки"
                                        value={selectedWarehouse}
                                        onChange={(e) => setSelectedWarehouse(e.target.value)}
                                        options={[
                                            { value: '', label: 'Выберите склад' },
                                            ...MOCK_WAREHOUSES.map(w => ({ value: w.id, label: w.name }))
                                        ]}
                                    />
                                    <Button
                                        onClick={handleReceiveOrder}
                                        disabled={saving || !selectedWarehouse}
                                        className="bg-emerald-600 hover:bg-emerald-700"
                                    >
                                        {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                        <Package className="w-4 h-4 mr-2" />
                                        Принять на склад
                                    </Button>
                                </>
                            )}

                            {canEditQuantities && (
                                <Button
                                    onClick={handleSaveReceivedQuantities}
                                    disabled={saving}
                                    className="bg-emerald-600 hover:bg-emerald-700"
                                >
                                    {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                    Сохранить количество
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="text-center py-12 text-slate-400">
                    Заказ не найден
                </div>
            )}
        </Modal>
    );
}
