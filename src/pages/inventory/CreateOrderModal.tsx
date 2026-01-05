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
    const [deliveryMethod, setDeliveryMethod] = useState<'pickup' | 'nova_poshta' | 'supplier_included' | 'supplier_extra'>('pickup');
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

    // Deduplicate materials by SKU for display
    // Implementation Plan:
    // 1. Group items by Normalized SKU (remove special chars, lowercase)
    // 2. For each SKU group, pick the "best" item (e.g. one with ID, or just first one)
    // 3. Normalized list used for Select options
    const normalizedMaterials = items.length === 0 && materials.length > 0 ? (() => {
        const skuMap = new Map<string, InventoryItem>();
        // Helper to normalize sku
        const norm = (s?: string) => s ? s.trim().toLowerCase().replace(/[^a-z0-9]/g, '') : '';

        materials.forEach(item => {
            if (!item.sku) {
                // Items without SKU are kept as is (using ID as key backup)
                skuMap.set(`no-sku-${item.id}`, item);
                return;
            }
            const key = norm(item.sku);
            if (!key) {
                skuMap.set(`empty-sku-${item.id}`, item);
                return;
            }

            // If duplicate SKU, we only keep the FIRST one we encounter
            // This solves the '8141/1' duplicate issue in dropdown
            if (!skuMap.has(key)) {
                skuMap.set(key, item);
            }
        });
        return Array.from(skuMap.values()).sort((a, b) => (a.sku || '').localeCompare(b.sku || ''));
    })() : materials;

    // Delivery cost state
    const [deliveryCost, setDeliveryCost] = useState<number | string>(0);

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
                    total_amount: totalCost + Number(deliveryCost), // Include delivery cost
                    order_date: new Date().toISOString(),
                    // Save delivery info in notes or metadata if specific column doesn't exist
                    // Assuming 'notes' column exists or we append to comment
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
            setDeliveryCost(0);

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
                    <div className="space-y-2">
                        <Select
                            label="Способ доставки"
                            options={[
                                { value: 'pickup', label: 'Самовывоз (Наш транспорт)' },
                                { value: 'nova_poshta', label: 'Новая Почта' },
                                { value: 'supplier_included', label: 'Доставка поставщиком (Входит в цену)' },
                                { value: 'supplier_extra', label: 'Доставка поставщиком (Доп. затраты)' }
                            ]}
                            value={deliveryMethod}
                            onChange={e => setDeliveryMethod(e.target.value as any)}
                        />
                        {deliveryMethod === 'supplier_extra' && (
                            <Input
                                placeholder="Стоимость доставки (₴)"
                                type="number"
                                min="0"
                                value={deliveryCost}
                                onChange={e => setDeliveryCost(Number(e.target.value))}
                                className="mt-1"
                            />
                        )}
                    </div>
                </div>

                {/* Items List */}
                <div className="space-y-3">
                    <div className="space-y-3 bg-slate-900 p-4 rounded-lg border border-slate-700">
                        <h4 className="text-sm font-medium text-slate-300">Товары</h4>

                        {/* Search Field */}
                        <Input
                            label="Поиск материала"
                            placeholder="Артикул или название..."
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
                                            // USE NORMALIZED MATERIALS for deduplication
                                            ...(searchTerm ? normalizedMaterials.filter(m =>
                                                m.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                                m.sku?.toLowerCase().includes(searchTerm.toLowerCase())
                                            ) : normalizedMaterials)
                                                .map(m => ({
                                                    value: m.id,
                                                    // Display SKU FIRST as requested
                                                    label: `${m.sku ? `[${m.sku}] ` : ''}${m.name || 'Без названия'}`
                                                }))
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
