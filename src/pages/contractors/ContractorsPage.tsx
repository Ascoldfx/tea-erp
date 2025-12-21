import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Input } from '../../components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Users, Package, Factory } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import ContractorDetailsModal from './ContractorDetailsModal';

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
    const [contractors, setContractors] = useState<Contractor[]>([]);
    const [productionOrders, setProductionOrders] = useState<ProductionOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedContractor, setSelectedContractor] = useState<Contractor | null>(null);
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        if (!supabase) {
            setLoading(false);
            return;
        }

        try {
            // Fetch only packaging contractors (Фито, ТС, Кава, Бакалея, ТС Трейд) - exclude suppliers
            // Подрядчики по фасовке: Фито, ТС, Кава, Бакалея, ТС Трейд
            const { data: contractorsData, error: contractorsError } = await supabase
                .from('contractors')
                .select('*')
                .in('id', ['wh-fito', 'wh-ts', 'wh-kava', 'wh-bakaleya', 'wh-ts-treyd'])
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

    const handleContractorClick = (contractor: Contractor) => {
        setSelectedContractor(contractor);
        setIsDetailsModalOpen(true);
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
                        
                        return (
                            <Card 
                                key={contractor.id} 
                                className="border-slate-800 cursor-pointer hover:border-slate-700 transition-colors group"
                                onDoubleClick={() => handleContractorClick(contractor)}
                            >
                                <CardHeader>
                                    <div className="flex items-center gap-3">
                                        <Factory className="w-6 h-6 text-blue-400" />
                                        <CardTitle className="text-xl group-hover:text-emerald-400 transition-colors">
                                            {contractor.name}
                                        </CardTitle>
                                        <span className="px-2 py-1 bg-slate-800 text-slate-400 text-xs rounded font-mono">
                                            {contractor.code}
                                        </span>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-3">
                                        {/* Quick Summary */}
                                        <div className="flex items-center gap-4 text-sm text-slate-400">
                                            {orders.length > 0 && (
                                                <div className="flex items-center gap-2">
                                                    <Package className="w-4 h-4" />
                                                    <span>
                                                        {orders.length} {t('contractors.activeOrders') || 'заказов в работе'}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                        <p className="text-xs text-slate-500 italic">
                                            {t('contractors.doubleClickToDetails') || 'Двойной клик для просмотра деталей'}
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })
                )}
            </div>

            {/* Contractor Details Modal */}
            <ContractorDetailsModal
                isOpen={isDetailsModalOpen}
                onClose={() => {
                    setIsDetailsModalOpen(false);
                    setSelectedContractor(null);
                }}
                contractor={selectedContractor}
            />
        </div>
    );
}
