import { useState, useEffect } from 'react';
import { Modal } from '../../components/ui/Modal';
import { supabase } from '../../lib/supabase';
import { ShoppingCart, Calendar, Package } from 'lucide-react';
import { clsx } from 'clsx';

interface SupplierOrdersModalProps {
    isOpen: boolean;
    onClose: () => void;
    supplierId: string;
    supplierName: string;
}

interface Order {
    id: string;
    status: string;
    total_amount: number;
    order_date: string;
    items_count?: number;
}

export default function SupplierOrdersModal({ isOpen, onClose, supplierId, supplierName }: SupplierOrdersModalProps) {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (isOpen && supplierId) {
            fetchOrders();
        }
    }, [isOpen, supplierId]);

    const fetchOrders = async () => {
        if (!supabase) {
            setLoading(false);
            return;
        }
        setLoading(true);

        try {
            const { data, error } = await supabase
                .from('orders')
                .select('id, status, total_amount, order_date')
                .eq('contractor_id', supplierId)
                .order('order_date', { ascending: false });

            if (error) throw error;

            // Get item counts for each order
            const ordersWithCounts = await Promise.all(
                (data || []).map(async (order) => {
                    if (!supabase) return { ...order, items_count: 0 };

                    const { count } = await supabase
                        .from('order_items')
                        .select('*', { count: 'exact', head: true })
                        .eq('order_id', order.id);

                    return { ...order, items_count: count || 0 };
                })
            );

            setOrders(ordersWithCounts);
        } catch (error) {
            console.error('Error fetching orders:', error);
        } finally {
            setLoading(false);
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'ordered': return 'Заказано';
            case 'shipped': return 'В пути';
            case 'delivered': return 'Доставлено';
            case 'cancelled': return 'Отменено';
            default: return status;
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'delivered': return 'bg-emerald-900/40 text-emerald-400';
            case 'shipped': return 'bg-amber-900/40 text-amber-400';
            case 'cancelled': return 'bg-red-900/40 text-red-400';
            default: return 'bg-blue-900/40 text-blue-400';
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`История заказов: ${supplierName}`}>
            <div className="space-y-4">
                {loading ? (
                    <div className="text-center py-8 text-slate-400">Загрузка...</div>
                ) : orders.length === 0 ? (
                    <div className="text-center py-12 text-slate-500">
                        <ShoppingCart className="w-12 h-12 mx-auto mb-4 opacity-20" />
                        <p>Нет заказов от этого поставщика</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {orders.map(order => (
                            <div
                                key={order.id}
                                className="bg-slate-900 border border-slate-800 rounded-lg p-4 hover:border-slate-700 transition-colors"
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex items-center gap-2">
                                        <ShoppingCart className="w-4 h-4 text-slate-500" />
                                        <span className="text-sm text-slate-400">ID: {order.id.slice(0, 8)}...</span>
                                    </div>
                                    <div className={clsx("px-2 py-1 rounded-full text-xs font-medium", getStatusColor(order.status))}>
                                        {getStatusLabel(order.status)}
                                    </div>
                                </div>

                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-4 text-sm">
                                        <span className="flex items-center gap-1 text-slate-400">
                                            <Calendar className="w-3.5 h-3.5" />
                                            {new Date(order.order_date).toLocaleDateString('ru-RU')}
                                        </span>
                                        <span className="flex items-center gap-1 text-slate-400">
                                            <Package className="w-3.5 h-3.5" />
                                            {order.items_count} поз.
                                        </span>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-lg font-bold text-emerald-400">
                                            {order.total_amount.toLocaleString()} ₴
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                <div className="pt-4 border-t border-slate-800">
                    <div className="flex justify-between text-sm">
                        <span className="text-slate-400">Всего заказов:</span>
                        <span className="font-semibold text-slate-200">{orders.length}</span>
                    </div>
                    <div className="flex justify-between text-sm mt-2">
                        <span className="text-slate-400">Общая сумма:</span>
                        <span className="font-bold text-emerald-400">
                            {orders.reduce((sum, o) => sum + o.total_amount, 0).toLocaleString()} ₴
                        </span>
                    </div>
                </div>
            </div>
        </Modal>
    );
}
