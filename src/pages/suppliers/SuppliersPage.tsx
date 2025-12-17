import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Package, Plus, Edit2, Trash2, Loader2 } from 'lucide-react';
import CreateSupplierModal from './CreateSupplierModal';
import SupplierOrdersModal from './SupplierOrdersModal';
import EditSupplierModal from './EditSupplierModal';
import { Modal } from '../../components/ui/Modal';
import { useAuth } from '../../context/AuthContext';

interface Contractor {
    id: string;
    name: string;
    contact_person?: string;
    phone?: string;
    email?: string;
    created_at: string;
}

export default function SuppliersPage() {
    const { user } = useAuth();
    const [contractors, setContractors] = useState<Contractor[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isOrdersModalOpen, setIsOrdersModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [selectedSupplier, setSelectedSupplier] = useState<Contractor | null>(null);
    const [supplierToEdit, setSupplierToEdit] = useState<Contractor | null>(null);
    const [supplierToDelete, setSupplierToDelete] = useState<Contractor | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
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

    const handleEdit = (contractor: Contractor) => {
        setSupplierToEdit(contractor);
        setIsEditModalOpen(true);
    };

    const handleDelete = async () => {
        if (!supplierToDelete || !supabase) return;

        setIsDeleting(true);
        try {
            // Check if supplier has any orders
            const { data: orders, error: ordersError } = await supabase
                .from('orders')
                .select('id')
                .eq('contractor_id', supplierToDelete.id)
                .limit(1);

            if (ordersError) {
                console.error('Error checking orders:', ordersError);
            }

            if (orders && orders.length > 0) {
                alert('Нельзя удалить поставщика, у которого есть заказы. Сначала удалите или измените заказы.');
                setIsDeleting(false);
                setSupplierToDelete(null);
                return;
            }

            const { error } = await supabase
                .from('contractors')
                .delete()
                .eq('id', supplierToDelete.id);

            if (error) throw error;

            alert('Поставщик успешно удален!');
            fetchContractors();
            setSupplierToDelete(null);
        } catch (error: any) {
            console.error('Error deleting supplier:', error);
            alert(`Ошибка при удалении поставщика: ${error?.message || 'Неизвестная ошибка'}`);
        } finally {
            setIsDeleting(false);
        }
    };

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
                                    {(user?.role === 'admin' || user?.role === 'procurement') && (
                                        <>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="text-blue-400 hover:text-blue-300"
                                                onClick={() => handleEdit(contractor)}
                                                title="Редактировать"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="text-red-400 hover:text-red-300"
                                                onClick={() => setSupplierToDelete(contractor)}
                                                title="Удалить"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </>
                                    )}
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="text-slate-400 hover:text-slate-200"
                                        onClick={() => {
                                            setSelectedSupplier(contractor);
                                            setIsOrdersModalOpen(true);
                                        }}
                                    >
                                        История заказов
                                    </Button>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Modals */}
            <CreateSupplierModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                onSuccess={fetchContractors}
            />

            {selectedSupplier && (
                <SupplierOrdersModal
                    isOpen={isOrdersModalOpen}
                    onClose={() => {
                        setIsOrdersModalOpen(false);
                        setSelectedSupplier(null);
                    }}
                    supplierId={selectedSupplier.id}
                    supplierName={selectedSupplier.name}
                />
            )}

            <EditSupplierModal
                isOpen={isEditModalOpen}
                onClose={() => {
                    setIsEditModalOpen(false);
                    setSupplierToEdit(null);
                }}
                onSuccess={() => {
                    fetchContractors();
                    setIsEditModalOpen(false);
                    setSupplierToEdit(null);
                }}
                supplier={supplierToEdit}
            />

            {/* Delete Confirmation Modal */}
            <Modal
                isOpen={!!supplierToDelete}
                onClose={() => setSupplierToDelete(null)}
                title="Подтверждение удаления"
            >
                <div className="space-y-4">
                    <p className="text-slate-300">
                        Вы уверены, что хотите удалить поставщика <strong className="text-slate-100">{supplierToDelete?.name}</strong>?
                    </p>
                    <p className="text-sm text-red-400">
                        ⚠️ Это действие нельзя отменить. Поставщик с существующими заказами не может быть удален.
                    </p>
                    <div className="flex justify-end gap-3 pt-4">
                        <Button 
                            type="button" 
                            variant="ghost" 
                            onClick={() => setSupplierToDelete(null)}
                            disabled={isDeleting}
                        >
                            Отмена
                        </Button>
                        <Button 
                            type="button"
                            onClick={handleDelete}
                            disabled={isDeleting}
                            className="bg-red-600 hover:bg-red-700 text-white"
                        >
                            {isDeleting ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Удаление...
                                </>
                            ) : (
                                <>
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Удалить
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
