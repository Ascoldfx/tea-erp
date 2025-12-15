import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Input } from '../../components/ui/Input';
import { Users, Phone, Mail, Package } from 'lucide-react';

interface Contractor {
    id: string;
    name: string;
    code: string;
    contact_person: string | null;
    phone: string | null;
    email: string | null;
}

export default function ContractorsPage() {
    const [contractors, setContractors] = useState<Contractor[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchContractors();
    }, []);

    const fetchContractors = async () => {
        if (!supabase) {
            setLoading(false);
            return;
        }

        try {
            // Fetch contractors (those who do packaging)
            const { data, error } = await supabase
                .from('contractors')
                .select('*')
                .order('name');

            if (error) throw error;
            setContractors(data || []);
        } catch (error) {
            console.error('Error fetching contractors:', error);
        } finally {
            setLoading(false);
        }
    };

    const filteredContractors = contractors.filter(c =>
        !searchTerm ||
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.code.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-slate-100">Подрядчики</h1>
                    <p className="text-slate-400 mt-1">Управление подрядчиками по фасовке чая</p>
                </div>
            </div>

            {/* Search */}
            <div className="flex gap-4">
                <div className="flex-1">
                    <Input
                        placeholder="Поиск по названию или коду..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {/* Contractors List */}
            <div className="grid gap-4">
                {loading ? (
                    <div className="text-center py-12 text-slate-400">Загрузка...</div>
                ) : filteredContractors.length === 0 ? (
                    <div className="text-center py-12 text-slate-500">
                        <Users className="w-12 h-12 mx-auto mb-4 opacity-20" />
                        <p>Нет подрядчиков</p>
                    </div>
                ) : (
                    filteredContractors.map(contractor => (
                        <div
                            key={contractor.id}
                            className="bg-slate-900 border border-slate-800 rounded-lg p-6 hover:border-slate-700 transition-colors"
                        >
                            <div className="flex justify-between items-start">
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-2">
                                        <Users className="w-5 h-5 text-blue-400" />
                                        <h3 className="text-lg font-semibold text-slate-100">{contractor.name}</h3>
                                        <span className="px-2 py-0.5 bg-slate-800 text-slate-400 text-xs rounded font-mono">
                                            {contractor.code}
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 mt-4 text-sm">
                                        {contractor.contact_person && (
                                            <div>
                                                <span className="text-slate-500">Контакт:</span>
                                                <span className="text-slate-300 ml-2">{contractor.contact_person}</span>
                                            </div>
                                        )}
                                        {contractor.phone && (
                                            <div>
                                                <span className="text-slate-500">Телефон:</span>
                                                <span className="text-slate-300 ml-2">{contractor.phone}</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Placeholder for production data */}
                                    <div className="mt-4 pt-4 border-t border-slate-800">
                                        <div className="grid grid-cols-3 gap-4 text-sm">
                                            <div className="bg-slate-800/50 p-3 rounded">
                                                <div className="text-slate-500 text-xs">Текущие задачи</div>
                                                <div className="text-2xl font-bold text-yellow-400 mt-1">-</div>
                                            </div>
                                            <div className="bg-slate-800/50 p-3 rounded">
                                                <div className="text-slate-500 text-xs">Материалы переданы</div>
                                                <div className="text-2xl font-bold text-blue-400 mt-1">-</div>
                                            </div>
                                            <div className="bg-slate-800/50 p-3 rounded">
                                                <div className="text-slate-500 text-xs">Выполнено заказов</div>
                                                <div className="text-2xl font-bold text-emerald-400 mt-1">-</div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-4 text-xs text-slate-500">
                                        <Package className="w-3 h-3 inline mr-1" />
                                        Функционал истории заказов и передачи материалов в разработке
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
