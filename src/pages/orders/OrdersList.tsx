import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Card, CardContent } from '../../components/ui/Card';
import { ShoppingCart, Calendar, Truck } from 'lucide-react';

interface Order {
    id: string;
    status: string;
    total_amount: number;
    order_date: string;
    contractor: { name: string } | null;
}

export default function OrdersList() {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchOrders();
    }, []);

    const fetchOrders = async () => {
        if (!supabase) return;
        try {
            const { data, error } = await supabase
                .from('orders')
                .select(`
                    id, 
                    status, 
                    total_amount, 
                    order_date,
                    contractors (name)
                `)
                .order('order_date', { ascending: false });

            if (error) throw error;

            // Map join result to cleaner object
            const mappedOrders = (data || []).map(o => ({
                ...o,
                contractor: o.contractors // Supabase join returns array or object depending on relationship, usually object for many-to-one
            }));

            // @ts-ignore
            setOrders(mappedOrders);
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

    if (loading) return <div className="p-8 text-slate-400">Loading orders...</div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-100">Заказы поставщикам</h1>
                    <p className="text-slate-400">История и статус текущих заказов</p>
                </div>
            </div>

            <div className="grid gap-4">
                {orders.length === 0 ? (
                    <Card className="bg-slate-900 border-slate-800">
                        <CardContent className="flex flex-col items-center justify-center h-48 text-slate-500">
                            <ShoppingCart className="w-12 h-12 mb-4 opacity-20" />
                            <p>Заказов пока нет</p>
                        </CardContent>
                    </Card>
                ) : (
                    orders.map(order => (
                        <Card key={order.id} className="bg-slate-900 border-slate-800 hover:border-slate-700 transition-colors">
                            <CardContent className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div className="flex items-start gap-4">
                                    <div className={`p-3 rounded-lg ${getStatusColor(order.status)}`}>
                                        <ShoppingCart className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h3 className="font-medium text-slate-200 text-lg">
                                            {/* @ts-ignore - Supabase join typing is tricky without generated types */}
                                            {order.contractor?.name || 'Неизвестный поставщик'}
                                        </h3>
                                        <div className="flex items-center gap-4 text-sm text-slate-400 mt-1">
                                            <span className="flex items-center gap-1">
                                                <Calendar className="w-3.5 h-3.5" />
                                                {new Date(order.order_date).toLocaleDateString()}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <Truck className="w-3.5 h-3.5" />
                                                ID: {order.id.slice(0, 8)}...
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between md:justify-end gap-6 flex-1">
                                    <div className={`px-3 py-1 rounded-full text-xs font-medium border border-white/5 ${getStatusColor(order.status)}`}>
                                        {getStatusLabel(order.status)}
                                    </div>
                                    <div className="text-right">
                                        <div className="text-lg font-bold text-emerald-400">
                                            {order.total_amount.toLocaleString()} ₴
                                        </div>
                                        <div className="text-xs text-slate-500">Сумма заказа</div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>
        </div>
    );
}
