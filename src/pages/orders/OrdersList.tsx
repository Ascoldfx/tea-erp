import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { ShoppingCart } from 'lucide-react';
import { clsx } from 'clsx';
import OrderDetailsModal from './OrderDetailsModal';
import { useLanguage } from '../../context/LanguageContext';

interface OrderItem {
    id: string;
    item_id: string;
    quantity: number;
    item?: {
        name: string;
        sku: string;
        unit: string;
    };
}

interface Order {
    id: string;
    contractor_id: string;
    contractor?: { name: string };
    status: string;
    total_amount: number;
    order_date: string;
    items?: OrderItem[];
}

export default function OrdersList() {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

    useEffect(() => {
        fetchOrders();
    }, []);

    const fetchOrders = async () => {
        if (!supabase) {
            console.error('Supabase not initialized');
            setLoading(false);
            return;
        }

        try {
            // Fetch orders with supplier/contractor info
            const { data: ordersData, error: ordersError } = await supabase
                .from('orders')
                .select('id, supplier_id, contractor_id, status, total_amount, order_date, suppliers(name), contractors(name)')
                .order('order_date', { ascending: false });

            if (ordersError) throw ordersError;

            // Fetch order items for each order
            const ordersWithItems = await Promise.all(
                (ordersData || []).map(async (order) => {
                    if (!supabase) return { ...order, contractor: order.contractors as any, items: [] };

                    const { data: itemsData } = await supabase
                        .from('order_items')
                        .select('id, item_id, quantity, received_quantity, items(name, sku, unit)')
                        .eq('order_id', order.id);

                    const supplier = (order.suppliers as any) || null;
                    const contractor = (order.contractors as any) || null;
                    
                    return {
                        ...order,
                        supplier,
                        contractor,
                        items: (itemsData || []).map(item => ({
                            ...item,
                            item: item.items as any
                        }))
                    };
                })
            );

            setOrders(ordersWithItems);
        } catch (e) {
            console.error('Error fetching orders:', e);
        } finally {
            setLoading(false);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'draft': return 'text-slate-400 bg-slate-800';
            case 'ordered': return 'text-blue-400 bg-blue-900/30';
            case 'shipped': return 'text-amber-400 bg-amber-900/30';
            case 'delivered': return 'text-emerald-400 bg-emerald-900/30';
            case 'cancelled': return 'text-red-400 bg-red-900/30';
            default: return 'text-slate-400';
        }
    };

    const handleOrderClick = (orderId: string) => {
        setSelectedOrderId(orderId);
        setIsDetailsModalOpen(true);
    };

    const handleModalClose = () => {
        setIsDetailsModalOpen(false);
        setSelectedOrderId(null);
    };

    const handleOrderUpdated = () => {
        fetchOrders(); // Refresh the list
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

    const { t } = useLanguage();

    if (loading) return <div className="p-8 text-slate-400">{t('orders.loading')}</div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-100">{t('orders.suppliers')}</h1>
                    <p className="text-slate-400">{t('orders.subtitle')}</p>
                </div>
            </div>

            <div className="grid gap-4">
                {loading ? (
                    <div className="p-8 text-slate-400 text-center">{t('orders.loading')}</div>
                ) : orders.length === 0 ? (
                    <div className="bg-slate-900 border-slate-800 rounded-lg">
                        <div className="flex flex-col items-center justify-center h-48 text-slate-500">
                            <ShoppingCart className="w-12 h-12 mb-4 opacity-20" />
                            <p>Заказов пока нет</p>
                        </div>
                    </div>
                ) : (
                    orders.map(order => (
                        <div
                            key={order.id}
                            onClick={() => handleOrderClick(order.id)}
                            className="bg-slate-900 border border-slate-800 rounded-lg p-4 hover:border-emerald-600 transition-all cursor-pointer"
                        >
                            <div className="flex justify-between items-start mb-3">
                                <div className="flex items-center gap-3">
                                    <div className={clsx(
                                        "p-3 rounded-full",
                                        getStatusColor(order.status)
                                    )}>
                                        <ShoppingCart className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-slate-200">
                                            {/* @ts-ignore - Supabase join typing is tricky without generated types */}
                                            {(order.supplier || order.contractor)?.name || 'Неизвестный поставщик'}
                                        </h3>
                                        <p className="text-sm text-slate-400">
                                            📅 {new Date(order.order_date).toLocaleDateString('ru-RU')}
                                            {' • '}🆔 {order.id.slice(0, 8)}...
                                        </p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className={clsx(
                                        "px-3 py-1 rounded-full text-sm font-medium mb-2",
                                        order.status === 'delivered' ? "bg-emerald-900/40 text-emerald-400" :
                                            order.status === 'shipped' ? "bg-amber-900/40 text-amber-400" :
                                                order.status === 'cancelled' ? "bg-red-900/40 text-red-400" :
                                                    "bg-blue-900/40 text-blue-400"
                                    )}>
                                        {getStatusLabel(order.status)}
                                    </div>
                                    <p className="text-lg font-bold text-emerald-400">
                                        {order.total_amount.toLocaleString()} ₴
                                    </p>
                                    <p className="text-xs text-slate-500">Сумма заказа</p>
                                </div>
                            </div>

                            {/* Order Items List */}
                            {order.items && order.items.length > 0 && (
                                <div className="mt-3 pt-3 border-t border-slate-800">
                                    <p className="text-xs text-slate-400 mb-2">Состав заказа:</p>
                                    <div className="space-y-1">
                                        {order.items.slice(0, 3).map(item => {
                                            const receivedQty = (item as any).received_quantity || 0;
                                            const hasReceivedQty = receivedQty > 0;
                                            const qtyDiffers = hasReceivedQty && receivedQty !== item.quantity;
                                            
                                            return (
                                                <div key={item.id} className="flex justify-between text-sm">
                                                    <span className="text-slate-300">
                                                        {item.item?.name || 'Материал'}
                                                    </span>
                                                    <div className="text-right">
                                                        <span className="text-slate-400">
                                                            {item.quantity} {item.item?.unit || 'шт'}
                                                        </span>
                                                        {hasReceivedQty && (
                                                            <div className={qtyDiffers ? "text-amber-400 text-xs" : "text-emerald-400 text-xs"}>
                                                                Факт: {receivedQty} {item.item?.unit || 'шт'}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        {order.items.length > 3 && (
                                            <p className="text-xs text-slate-500 italic">
                                                +ещё {order.items.length - 3} поз.
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>

            {/* Order Details Modal */}
            {selectedOrderId && (
                <OrderDetailsModal
                    isOpen={isDetailsModalOpen}
                    onClose={handleModalClose}
                    orderId={selectedOrderId}
                    onOrderUpdated={handleOrderUpdated}
                />
            )}
        </div>
    );
}
