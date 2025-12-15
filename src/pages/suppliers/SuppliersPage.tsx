import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Package, Plus, Trash2 } from 'lucide-react';

interface Contractor {
    id: string;
    name: string;
    contact_person?: string;
    phone?: string;
    email?: string;
    created_at: string;
}

export default function SuppliersPage() {
    const [contractors, setContractors] = useState<Contractor[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchContractors();
    }, []);

    const fetchContractors = async () => {
        if (!supabase) return;
        setLoading(true);

        try {
            const { data, error } = await supabase
                .from('contractors')
                .select('*')
                .order('name', { ascending: true });

            if (error) throw error;
            setContractors(data || []);
        } catch (e) {
            console.error('Error fetching contractors:', e);
        } finally {
            setLoading(false);
        }
    };

    const filteredContractors = contractors.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading) {
        return <div className="p-8 text-slate-400">Загрузка поставщиков...</div>;
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-100">Поставщики</h1>
                    <p className="text-slate-400">Управление контрагентами и история заказов</p>
                </div>
                <Button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="bg-emerald-600 hover:bg-emerald-700"
                >
                    <Plus className="w-4 h-4 mr-2" />
                    Добавить поставщика
                </Button>
            </div>

            {/* Search */}
            <div className="max-w-md">
                <Input
                    placeholder="Поиск по названию или email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            {/* Suppliers List */}
            <div className="grid gap-4">
                {filteredContractors.length === 0 ? (
                    <div className="text-center py-12 text-slate-500">
                        <Package className="w-12 h-12 mx-auto mb-4 opacity-20" />
                        <p>Поставщики не найдены</p>
                    </div>
                ) : (
                    filteredContractors.map(contractor => (
                        <div
                            key={contractor.id}
                            className="bg-slate-900 border border-slate-800 rounded-lg p-4 hover:border-slate-700 transition-colors"
                        >
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="font-semibold text-slate-200 text-lg">
                                        {contractor.name}
                                    </h3>
                                    {contractor.contact_person && (
                                        <p className="text-sm text-slate-400">
                                            Контакт: {contractor.contact_person}
                                        </p>
                                    )}
                                    <div className="flex gap-4 mt-2 text-sm text-slate-500">
                                        {contractor.phone && <span>📞 {contractor.phone}</span>}
                                        {contractor.email && <span>📧 {contractor.email}</span>}
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="text-slate-400 hover:text-slate-200"
                                    >
                                        История заказов
                                    </Button>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
