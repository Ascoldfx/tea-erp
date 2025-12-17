import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Input } from '../../components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Users, Package, Factory } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useInventory } from '../../hooks/useInventory';
import { clsx } from 'clsx';

interface Contractor {
    id: string;
    name: string;
    code: string;
    contact_person: string | null;
    phone: string | null;
    email: string | null;
}

interface ProductionOrder {
    id: string;
    contractor_id: string;
    item_id: string;
    quantity: number;
    status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
    deadline: string | null;
    completed_quantity: number;
    notes: string | null;
}


export default function ContractorsPage() {
    const { t } = useLanguage();
    const { items, stock } = useInventory();
    const [contractors, setContractors] = useState<Contractor[]>([]);
    const [productionOrders, setProductionOrders] = useState<ProductionOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        if (!supabase) {
            setLoading(false);
            return;
        }

        try {
            // Fetch contractors (Фито, ТС)
            const { data: contractorsData, error: contractorsError } = await supabase
                .from('contractors')
                .select('*')
                .order('name');

            if (contractorsError) throw contractorsError;

            // Fetch production orders
            const { data: ordersData, error: ordersError } = await supabase
                .from('production_orders')
                .select('*')
                .in('status', ['pending', 'in_progress']);

            if (ordersError) console.error('Error fetching orders:', ordersError);

            setContractors(contractorsData || []);
            setProductionOrders(ordersData || []);
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    const filteredContractors = contractors.filter(c =>
        !searchTerm ||
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.code.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getContractorOrders = (contractorId: string) => {
        return productionOrders.filter(o => o.contractor_id === contractorId);
    };

    const getContractorMaterials = (contractorId: string) => {
        // Get materials stored at contractor's warehouse
        const contractorStock = stock.filter(s => s.warehouseId === contractorId);
        return contractorStock.map(s => {
            const item = items.find(i => i.id === s.itemId);
            return {
                itemId: s.itemId,
                itemName: item?.name || s.itemId,
                quantity: s.quantity,
                unit: item?.unit || 'шт'
            };
        });
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-slate-100">{t('nav.contractors')}</h1>
                    <p className="text-slate-400 mt-1">
                        {t('contractors.subtitle') || 'Подрядчики по фасовке чая: Фито, ТС'}
                    </p>
                </div>
            </div>

            {/* Search */}
            <div className="flex gap-4">
                <div className="flex-1">
                    <Input
                        placeholder={t('contractors.search')}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {/* Contractors List */}
            <div className="grid gap-6">
                {loading ? (
                    <div className="text-center py-12 text-slate-400">{t('common.loading')}</div>
                ) : filteredContractors.length === 0 ? (
                    <div className="text-center py-12 text-slate-500">
                        <Users className="w-12 h-12 mx-auto mb-4 opacity-20" />
                        <p>{t('contractors.notFound')}</p>
                    </div>
                ) : (
                    filteredContractors.map(contractor => {
                        const orders = getContractorOrders(contractor.id);
                        const materials = getContractorMaterials(contractor.id);
                        
                        return (
                            <Card key={contractor.id} className="border-slate-800">
                                <CardHeader>
                                    <div className="flex items-center gap-3">
                                        <Factory className="w-6 h-6 text-blue-400" />
                                        <CardTitle className="text-xl">{contractor.name}</CardTitle>
                                        <span className="px-2 py-1 bg-slate-800 text-slate-400 text-xs rounded font-mono">
                                            {contractor.code}
                                        </span>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    {/* Open Orders */}
                                    <div>
                                        <h4 className="text-sm font-medium text-slate-400 mb-3 flex items-center gap-2">
                                            <Package className="w-4 h-4" />
                                            {t('contractors.openOrders') || 'Открытые заказы на фасовку'}
                                        </h4>
                                        {orders.length > 0 ? (
                                            <div className="space-y-2">
                                                {orders.map(order => {
                                                    const item = items.find(i => i.id === order.item_id);
                                                    return (
                                                        <div key={order.id} className="bg-slate-800/50 p-3 rounded-lg border border-slate-700">
                                                            <div className="flex items-center justify-between">
                                                                <div>
                                                                    <p className="text-slate-200 font-medium">{item?.name || order.item_id}</p>
                                                                    <p className="text-xs text-slate-400 mt-1">
                                                                        {t('contractors.quantity') || 'Количество'}: {order.quantity} {item?.unit || 'шт'}
                                                                        {order.completed_quantity > 0 && (
                                                                            <span className="ml-2 text-emerald-400">
                                                                                ({t('contractors.completed') || 'Выполнено'}: {order.completed_quantity})
                                                                            </span>
                                                                        )}
                                                                    </p>
                                                                    {order.deadline && (
                                                                        <p className="text-xs text-slate-500 mt-1">
                                                                            {t('contractors.deadline') || 'Срок'}: {new Date(order.deadline).toLocaleDateString()}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                                <span className={clsx(
                                                                    "px-2.5 py-0.5 rounded-full text-xs font-medium",
                                                                    order.status === 'in_progress' 
                                                                        ? 'bg-blue-900/30 text-blue-400' 
                                                                        : 'bg-yellow-900/30 text-yellow-400'
                                                                )}>
                                                                    {order.status === 'in_progress' 
                                                                        ? (t('contractors.inProgress') || 'В работе')
                                                                        : (t('contractors.pending') || 'Ожидает')}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <p className="text-slate-500 text-sm italic">
                                                {t('contractors.noOrders') || 'Нет открытых заказов'}
                                            </p>
                                        )}
                                    </div>

                                    {/* Materials at Contractor */}
                                    <div>
                                        <h4 className="text-sm font-medium text-slate-400 mb-3 flex items-center gap-2">
                                            <Package className="w-4 h-4" />
                                            {t('contractors.materialsAtContractor') || 'Наши материалы на складе подрядчика'}
                                        </h4>
                                        {materials.length > 0 ? (
                                            <div className="grid grid-cols-2 gap-2">
                                                {materials.map(mat => (
                                                    <div key={mat.itemId} className="bg-slate-800/50 p-3 rounded-lg border border-slate-700">
                                                        <p className="text-slate-200 text-sm font-medium truncate">{mat.itemName}</p>
                                                        <p className="text-slate-400 text-xs mt-1">
                                                            {mat.quantity} {mat.unit}
                                                        </p>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-slate-500 text-sm italic">
                                                {t('contractors.noMaterials') || 'Нет материалов на складе'}
                                            </p>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })
                )}
            </div>
        </div>
    );
}
