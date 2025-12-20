import { useState, useEffect, useMemo } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Package, Factory, CheckCircle, Clock, Search } from 'lucide-react';
import { clsx } from 'clsx';
import { supabase } from '../../lib/supabase';
import { useInventory } from '../../hooks/useInventory';
import { useLanguage } from '../../context/LanguageContext';

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
    completed_at: string | null;
}

interface ContractorDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    contractor: Contractor | null;
}

export default function ContractorDetailsModal({ isOpen, onClose, contractor }: ContractorDetailsModalProps) {
    const { t, language } = useLanguage();
    const { items, stock, warehouses } = useInventory();
    const [activeOrders, setActiveOrders] = useState<ProductionOrder[]>([]);
    const [completedOrders, setCompletedOrders] = useState<ProductionOrder[]>([]);
    const [loading, setLoading] = useState(false);
    const [materialSearchTerm, setMaterialSearchTerm] = useState('');

    useEffect(() => {
        if (isOpen && contractor) {
            fetchOrders();
        }
    }, [isOpen, contractor]);

    const fetchOrders = async () => {
        if (!contractor || !supabase) return;

        setLoading(true);
        try {
            // Fetch active orders (pending, in_progress)
            const { data: activeData, error: activeError } = await supabase
                .from('production_orders')
                .select('*')
                .eq('contractor_id', contractor.id)
                .in('status', ['pending', 'in_progress'])
                .order('created_at', { ascending: false });

            if (activeError) console.error('Error fetching active orders:', activeError);

            // Fetch completed orders (completed status with completed_quantity > 0)
            const { data: completedData, error: completedError } = await supabase
                .from('production_orders')
                .select('*')
                .eq('contractor_id', contractor.id)
                .eq('status', 'completed')
                .gt('completed_quantity', 0)
                .order('completed_at', { ascending: false });

            if (completedError) console.error('Error fetching completed orders:', completedError);

            setActiveOrders(activeData || []);
            setCompletedOrders(completedData || []);
        } catch (error) {
            console.error('Error fetching orders:', error);
        } finally {
            setLoading(false);
        }
    };

    // Get materials at contractor's warehouse
    const getContractorMaterials = () => {
        if (!contractor) return [];
        
        // Find warehouse for this contractor
        // Склады подрядчиков имеют ID, совпадающий с ID подрядчика (wh-ts, wh-fito)
        // Также проверяем type='contractor' или совпадение ID
        const contractorWarehouse = warehouses.find(w => 
            w.id === contractor.id || 
            (w.type === 'contractor' && w.contractor_id === contractor.id)
        );

        if (!contractorWarehouse) {
            console.log(`[ContractorDetailsModal] Warehouse not found for contractor ${contractor.id}. Available warehouses:`, warehouses.map(w => ({ id: w.id, type: w.type, contractor_id: w.contractor_id })));
            return [];
        }

        // Get stock levels for this warehouse
        const contractorStock = stock.filter(s => s.warehouseId === contractorWarehouse.id);

        console.log(`[ContractorDetailsModal] Found ${contractorStock.length} stock items for warehouse ${contractorWarehouse.id}`);

        return contractorStock
            .filter(s => s.quantity > 0) // Показываем только материалы с остатком > 0
            .map(s => {
                const item = items.find(i => i.id === s.itemId);
                return {
                    itemId: s.itemId,
                    itemName: item?.name || s.itemId,
                    sku: item?.sku || '',
                    category: item?.category || 'other',
                    quantity: s.quantity,
                    unit: item?.unit === 'pcs' ? 'шт' : (item?.unit || 'шт')
                };
            });
    };

    // Helper function to format category name for display
    const formatCategoryName = (category: string): string => {
        const translationKey = `materials.filter.${category}`;
        const translated = t(translationKey);
        if (translated !== translationKey) {
            return translated;
        }
        
        const categoryMap: Record<string, string> = {
            'envelope': language === 'uk' ? 'Конверти' : 'Конверты',
            'label': language === 'uk' ? 'Ярлики' : 'Ярлыки',
            'packaging_consumable': language === 'uk' ? 'Плівка' : 'Пленки',
            'packaging_crate': language === 'uk' ? 'Гофроящики' : 'Гофроящики',
            'soft_packaging': language === 'uk' ? 'М\'яка упаковка' : 'Мягкая упаковка',
            'flavor': language === 'uk' ? 'Ароматизатори' : 'Ароматизаторы',
            'tea_bulk': language === 'uk' ? 'Чайна сировина' : 'Чайное сырье',
            'sticker': language === 'uk' ? 'Стікери' : 'Стикеры',
            'other': language === 'uk' ? 'Інше' : 'Прочее',
            'packaging_cardboard': language === 'uk' ? 'Картонна упаковка' : 'Картонная упаковка'
        };
        
        if (categoryMap[category]) {
            return categoryMap[category];
        }
        
        return category
            .replace(/_/g, ' ')
            .replace(/\b\w/g, (char) => char.toUpperCase())
            .trim();
    };

    // Get all materials and filter by search term
    const allMaterials = useMemo(() => getContractorMaterials(), [contractor, warehouses, stock, items]);
    
    // Filter materials by search term
    const filteredMaterials = useMemo(() => {
        if (!materialSearchTerm.trim()) return allMaterials;
        
        const searchLower = materialSearchTerm.toLowerCase().trim();
        return allMaterials.filter(mat => 
            mat.itemName.toLowerCase().includes(searchLower) ||
            mat.sku.toLowerCase().includes(searchLower)
        );
    }, [allMaterials, materialSearchTerm]);

    // Group materials by category
    const groupedMaterials = useMemo(() => {
        const groups = new Map<string, typeof filteredMaterials>();
        
        filteredMaterials.forEach(mat => {
            const category = mat.category || 'other';
            if (!groups.has(category)) {
                groups.set(category, []);
            }
            groups.get(category)!.push(mat);
        });
        
        // Sort groups by category name
        const sortedGroups = Array.from(groups.entries()).sort((a, b) => {
            return formatCategoryName(a[0]).localeCompare(formatCategoryName(b[0]));
        });
        
        return sortedGroups;
    }, [filteredMaterials, formatCategoryName]);

    if (!contractor) return null;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={`${contractor.name} (${contractor.code})`}
        >
            <div className="space-y-6">
                {/* Contractor Header */}
                <div className="flex items-center gap-3 pb-4 border-b border-slate-700">
                    <Factory className="w-5 h-5 text-blue-400" />
                    <span className="text-lg font-semibold text-slate-200">{contractor.name}</span>
                    <span className="px-2 py-1 bg-slate-800 text-slate-400 text-xs rounded font-mono">
                        {contractor.code}
                    </span>
                </div>

                {/* Contact Info */}
                {(contractor.contact_person || contractor.phone || contractor.email) && (
                    <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
                        <h3 className="text-sm font-medium text-slate-400 mb-3">
                            {t('contractors.contactInfo') || 'Контактная информация'}
                        </h3>
                        <div className="space-y-2 text-sm">
                            {contractor.contact_person && (
                                <p className="text-slate-200">
                                    <span className="text-slate-400">{t('contractors.contactPerson') || 'Контактное лицо'}:</span>{' '}
                                    {contractor.contact_person}
                                </p>
                            )}
                            {contractor.phone && (
                                <p className="text-slate-200">
                                    <span className="text-slate-400">{t('contractors.phone') || 'Телефон'}:</span>{' '}
                                    {contractor.phone}
                                </p>
                            )}
                            {contractor.email && (
                                <p className="text-slate-200">
                                    <span className="text-slate-400">{t('contractors.email') || 'Email'}:</span>{' '}
                                    {contractor.email}
                                </p>
                            )}
                        </div>
                    </div>
                )}

                {/* Active Orders */}
                <div>
                    <h3 className="text-sm font-medium text-slate-400 mb-3 flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        {t('contractors.activeOrders') || 'Заказы в работе'}
                    </h3>
                    {loading ? (
                        <div className="text-center py-4 text-slate-500 text-sm">
                            {t('common.loading') || 'Загрузка...'}
                        </div>
                    ) : activeOrders.length > 0 ? (
                        <div className="space-y-2">
                            {activeOrders.map(order => {
                                const item = items.find(i => i.id === order.item_id);
                                return (
                                    <div key={order.id} className="bg-slate-800/50 p-3 rounded-lg border border-slate-700">
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                                <p className="text-slate-200 font-medium">{item?.name || order.item_id}</p>
                                                {item?.sku && (
                                                    <p className="text-xs text-slate-400 mt-1 font-mono">{item.sku}</p>
                                                )}
                                                <div className="mt-2 space-y-1">
                                                    <p className="text-xs text-slate-400">
                                                        {t('contractors.ordered') || 'Заказано'}: <span className="text-slate-200">{order.quantity}</span> {item?.unit || 'шт'}
                                                    </p>
                                                    {order.completed_quantity > 0 && (
                                                        <p className="text-xs text-emerald-400">
                                                            {t('contractors.completed') || 'Выполнено'}: {order.completed_quantity} {item?.unit || 'шт'}
                                                        </p>
                                                    )}
                                                    {order.deadline && (
                                                        <p className="text-xs text-slate-500">
                                                            {t('contractors.deadline') || 'Срок'}: {new Date(order.deadline).toLocaleDateString()}
                                                        </p>
                                                    )}
                                                    {order.notes && (
                                                        <p className="text-xs text-slate-500 italic mt-1">{order.notes}</p>
                                                    )}
                                                </div>
                                            </div>
                                            <span className={clsx(
                                                "px-2.5 py-0.5 rounded-full text-xs font-medium ml-3",
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
                            {t('contractors.noActiveOrders') || 'Нет заказов в работе'}
                        </p>
                    )}
                </div>

                {/* Completed Orders (Ready to Pick Up) */}
                <div>
                    <h3 className="text-sm font-medium text-slate-400 mb-3 flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-emerald-400" />
                        {t('contractors.readyToPickUp') || 'Готовая продукция (к забрать)'}
                    </h3>
                    {loading ? (
                        <div className="text-center py-4 text-slate-500 text-sm">
                            {t('common.loading') || 'Загрузка...'}
                        </div>
                    ) : completedOrders.length > 0 ? (
                        <div className="space-y-2">
                            {completedOrders.map(order => {
                                const item = items.find(i => i.id === order.item_id);
                                const readyQuantity = order.completed_quantity;
                                return (
                                    <div key={order.id} className="bg-emerald-900/20 border border-emerald-800/50 p-3 rounded-lg">
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                                <p className="text-emerald-200 font-medium">{item?.name || order.item_id}</p>
                                                {item?.sku && (
                                                    <p className="text-xs text-emerald-400/70 mt-1 font-mono">{item.sku}</p>
                                                )}
                                                <div className="mt-2 space-y-1">
                                                    <p className="text-sm text-emerald-300 font-medium">
                                                        {t('contractors.readyQuantity') || 'Готово к забрать'}: {readyQuantity} {item?.unit || 'шт'}
                                                    </p>
                                                    {order.completed_at && (
                                                        <p className="text-xs text-emerald-400/70">
                                                            {t('contractors.completedAt') || 'Завершено'}: {new Date(order.completed_at).toLocaleDateString()}
                                                        </p>
                                                    )}
                                                    {order.notes && (
                                                        <p className="text-xs text-emerald-400/70 italic mt-1">{order.notes}</p>
                                                    )}
                                                </div>
                                            </div>
                                            <CheckCircle className="w-5 h-5 text-emerald-400 ml-3 flex-shrink-0" />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <p className="text-slate-500 text-sm italic">
                            {t('contractors.noReadyProducts') || 'Нет готовой продукции'}
                        </p>
                    )}
                </div>

                {/* Materials at Contractor */}
                <div>
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-medium text-slate-400 flex items-center gap-2">
                            <Package className="w-4 h-4" />
                            {t('contractors.materialsAtContractor') || 'Наши материалы на складе подрядчика'}
                        </h3>
                    </div>
                    
                    {/* Search Filter */}
                    {allMaterials.length > 0 && (
                        <div className="relative mb-4">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500 w-4 h-4" />
                            <Input
                                placeholder={t('contractors.searchMaterials') || 'Поиск по названию или артикулу...'}
                                className="pl-10"
                                value={materialSearchTerm}
                                onChange={(e) => setMaterialSearchTerm(e.target.value)}
                            />
                        </div>
                    )}

                    {filteredMaterials.length > 0 ? (
                        <div className="space-y-4">
                            {groupedMaterials.map(([category, categoryMaterials]) => (
                                <div key={category}>
                                    <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2">
                                        {formatCategoryName(category)}
                                    </h4>
                                    <div className="grid grid-cols-1 gap-2">
                                        {categoryMaterials.map(mat => (
                                            <div key={mat.itemId} className="bg-slate-800/50 p-3 rounded-lg border border-slate-700">
                                                <div className="flex items-start justify-between">
                                                    <div className="flex-1">
                                                        <p className="text-slate-200 text-sm font-medium">{mat.itemName}</p>
                                                        {mat.sku && (
                                                            <p className="text-xs text-slate-400 mt-1 font-mono">{mat.sku}</p>
                                                        )}
                                                    </div>
                                                    <div className="text-right ml-3">
                                                        <p className="text-slate-300 text-sm font-medium">
                                                            {mat.quantity} {mat.unit}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : allMaterials.length > 0 ? (
                        <p className="text-slate-500 text-sm italic">
                            {t('contractors.noMaterialsFound') || 'Материалы не найдены'}
                        </p>
                    ) : (
                        <p className="text-slate-500 text-sm italic">
                            {t('contractors.noMaterials') || 'Нет материалов на складе'}
                        </p>
                    )}
                </div>
            </div>
        </Modal>
    );
}

