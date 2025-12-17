import { useState, useEffect } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { inventoryService } from '../../services/inventoryService';
import { supabase } from '../../lib/supabase';
import { Plus, Trash, DollarSign, ShoppingCart } from 'lucide-react';
import type { InventoryItem } from '../../types/inventory';

interface CreateOrderModalProps {
    isOpen: boolean;
    onClose: () => void;
}

interface OrderItem {
    itemId: string;
    quantity: number | string;
    costPerUnit: number | string;
}

interface Contractor {
    id: string;
    name: string;
    code?: string;
    contact_person?: string;
    phone?: string;
    email?: string;
}

export default function CreateOrderModal({ isOpen, onClose }: CreateOrderModalProps) {
    const [contractorId, setContractorId] = useState('');
    const [items, setItems] = useState<OrderItem[]>([{ itemId: '', quantity: 0, costPerUnit: 0 }]);
    const [searchTerm, setSearchTerm] = useState('');
    
    // Data from database
    const [materials, setMaterials] = useState<InventoryItem[]>([]);
    const [contractors, setContractors] = useState<Contractor[]>([]);
    const [loading, setLoading] = useState(false);

    // Financials & Logistics
    const [deliveryMethod, setDeliveryMethod] = useState<'pickup' | 'nova_poshta'>('pickup');
    const [prepayment, setPrepayment] = useState<number | string>(0);
    const [paymentTerms, setPaymentTerms] = useState<'prepayment' | 'postpayment' | '50_50'>('postpayment');
    const [paymentDelay, setPaymentDelay] = useState<number | string>(0);

    // Load materials and contractors when modal opens
    useEffect(() => {
        if (isOpen) {
            loadData();
        }
    }, [isOpen]);

    const loadData = async () => {
        setLoading(true);
        try {
            // Load materials
            const materialsData = await inventoryService.getItems();
            setMaterials(materialsData);

            // Load suppliers (for material orders)
            if (supabase) {
                const { data, error } = await supabase
                    .from('suppliers')
                    .select('id, name, code, contact_person, phone, email')
                    .order('name');

                if (error) {
                    console.error('Error loading suppliers:', error);
                } else {
                    setContractors(data || []);
                }
            }
        } catch (error) {
            console.error('Error loading data:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        // Payment terms are now manual, but we can keep this for future enhancements
        // if (contractorId) {
        //     const c = contractors.find(c => c.id === contractorId);
        //     // Could load payment terms from contractor if stored in DB
        // }
    }, [contractorId, contractors]);

    const totalCost = items.reduce((acc, item) => acc + (Number(item.quantity) * Number(item.costPerUnit)), 0);

    const handleAddItem = () => {
        setItems([...items, { itemId: '', quantity: 0, costPerUnit: 0 }]);
    };

    const handleRemoveItem = (index: number) => {
        setItems(items.filter((_, i) => i !== index));
    };

    const handleItemChange = (index: number, field: keyof OrderItem, value: any) => {
        const newItems = [...items];
        // @ts-ignore
        newItems[index][field] = value;
        setItems(newItems);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!supabase) {
            alert('Ошибка: Нет соединения с базой данных');
            return;
        }

        try {
            // 1. Create Order (using supplier_id for material orders)
            const { data: orderData, error: orderError } = await supabase
                .from('orders')
                .insert({
                    supplier_id: contractorId, // For material orders, use supplier_id
                    status: 'ordered',
                    total_amount: totalCost,
                    order_date: new Date().toISOString()
                })
                .select()
                .single();

            if (orderError) throw orderError;

            // 2. Create Order Items
            const orderItems = items.map(item => ({
                order_id: orderData.id,
                item_id: item.itemId,
                quantity: Number(item.quantity),
                price_per_unit: Number(item.costPerUnit)
            }));

            const { error: itemsError } = await supabase
                .from('order_items')
                .insert(orderItems);

            if (itemsError) throw itemsError;

            alert(`Заказ успешно размещен! ID: ${orderData.id.slice(0, 8)}...`);
            onClose();
            setContractorId('');
            setItems([{ itemId: '', quantity: 0, costPerUnit: 0 }]);
            setPrepayment(0);

        } catch (e: any) {
            console.error('Order placement error:', e);
            alert('Ошибка при размещении заказа: ' + e.message);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Размещение заказа поставщику">
            <form onSubmit={handleSubmit} className="space-y-6">

                {/* Contractor & Logistics */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Select
                        label="Поставщик"
                        options={[
                            { value: '', label: 'Выберите поставщика...' },
                            ...contractors.map(c => ({ value: c.id, label: c.name }))
                        ]}
                        value={contractorId}
                        onChange={e => setContractorId(e.target.value)}
                        required
                        disabled={loading}
                    />
                    <Select
                        label="Способ доставки"
                        options={[
                            { value: 'pickup', label: 'Самовывоз (Наш транспорт)' },
                            { value: 'nova_poshta', label: 'Новая Почта' }
                        ]}
                        value={deliveryMethod}
                        onChange={e => setDeliveryMethod(e.target.value as any)}
                    />
                </div>

                {/* Items List */}
                <div className="space-y-3">
                    <div className="space-y-3 bg-slate-900 p-4 rounded-lg border border-slate-700">
                        <h4 className="text-sm font-medium text-slate-300">Товары</h4>

                        {/* Search Field */}
                        <Input
                            label="Поиск материала"
                            placeholder="Название или артикул..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />

                        <div className="flex items-center gap-2">
                            <Button type="button" size="sm" onClick={handleAddItem}>
                                <Plus className="w-4 h-4 mr-1" />
                                Добавить позицию
                            </Button>
                        </div>
                        {items.map((item, index) => (
                            <div key={index} className="flex gap-2 items-end">
                                <div className="flex-1">
                                    <Select
                                        label={index === 0 ? "Материал" : undefined}
                                        options={[
                                            { value: '', label: 'Выберите материал' },
                                            ...materials
                                                .filter(m =>
                                                    !searchTerm ||
                                                    m.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                                    m.sku?.toLowerCase().includes(searchTerm.toLowerCase())
                                                )
                                                .map(m => ({ value: m.id, label: `${m.name || 'Без названия'} (${m.sku || 'нет артикула'})` }))
                                        ]}
                                        value={item.itemId}
                                        onChange={e => handleItemChange(index, 'itemId', e.target.value)}
                                        required
                                        disabled={loading}
                                    />
                                </div>
                                <div className="w-24">
                                    <Input
                                        label={index === 0 ? "Кол-во" : undefined}
                                        type="number"
                                        min="0"
                                        value={item.quantity}
                                        onChange={e => handleItemChange(index, 'quantity', e.target.value === '' ? '' : Number(e.target.value))}
                                        required
                                    />
                                </div>
                                <div className="w-24">
                                    <Input
                                        label={index === 0 ? "Цена (₴)" : undefined}
                                        type="number"
                                        min="0"
                                        value={item.costPerUnit}
                                        onChange={e => handleItemChange(index, 'costPerUnit', e.target.value === '' ? '' : Number(e.target.value))}
                                        required
                                    />
                                </div>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    className="mb-0.5 text-red-400 hover:text-red-300 hover:bg-red-900/20"
                                    onClick={() => handleRemoveItem(index)}
                                >
                                    <Trash className="w-4 h-4" />
                                </Button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Financial Summary */}
                <div className="bg-slate-900 p-4 rounded-lg border border-slate-700 space-y-4">
                    <div className="text-sm font-medium text-slate-300 flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-emerald-500" />
                        Финансы заказа
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Select
                            label="Условия оплаты"
                            options={[
                                { value: 'postpayment', label: 'Отсрочка' },
                                { value: 'prepayment', label: 'Предоплата' },
                                { value: '50_50', label: '50/50 (Часть пред, часть отлож)' }
                            ]}
                            value={paymentTerms}
                            onChange={e => setPaymentTerms(e.target.value as any)}
                        />
                        <Input
                            label="Отсрочка (дней)"
                            type="number"
                            value={paymentDelay}
                            onChange={e => setPaymentDelay(e.target.value === '' ? '' : Number(e.target.value))}
                            disabled={paymentTerms === 'prepayment'}
                        />
                        <Input
                            label="Предоплата (₴)"
                            type="number"
                            min="0"
                            max={totalCost}
                            value={prepayment}
                            onChange={e => setPrepayment(e.target.value === '' ? '' : Number(e.target.value))}
                            disabled={paymentTerms === 'postpayment'}
                        />
                    </div>

                    <div className="flex justify-between items-center pt-2 border-t border-slate-800">
                        <div className="text-sm text-slate-400">
                            Итого: <span className="text-slate-200 font-bold">{totalCost.toLocaleString()} ₴</span>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                    <Button type="button" variant="ghost" onClick={onClose}>
                        Отмена
                    </Button>
                    <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                        <ShoppingCart className="w-4 h-4 mr-2" />
                        Разместить заказ
                    </Button>
                </div>
            </form>
        </Modal>
    );
}
