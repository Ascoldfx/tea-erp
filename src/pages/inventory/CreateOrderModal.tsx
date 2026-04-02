import { useState, useEffect, useMemo } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { inventoryService } from '../../services/inventoryService';
import { supabase } from '../../lib/supabase';
import { Plus, Trash, DollarSign, ShoppingCart } from 'lucide-react';
import type { InventoryItem } from '../../types/inventory';
import { getPricingUnit, FOREIGN_CURRENCY_CATEGORIES } from '../../utils/unitDisplay';

interface CreateOrderModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialMaterialId?: string;
    initialQuantity?: number;
    initialTransitAmount?: number;
}

interface OrderItem {
    itemId: string;
    quantity: number | string;
    costPerUnit: number | string;
    currency: '₴' | '$' | '€';
    exchangeRate: number | string; // UAH per 1 unit of foreign currency
    tara?: string;                 // container size for flavors e.g. '9', '12', '25'
}

/** Categories that support foreign currency pricing (expanded to include labels) */
const MULTI_CURRENCY_CATEGORIES = [...FOREIGN_CURRENCY_CATEGORIES, 'label', 'sticker'];

/** Tara options for aromatic materials */
const FLAVOR_TARA_OPTIONS = [
    { value: '', label: 'Выберите тару...' },
    { value: '9', label: '9 кг (канистра)' },
    { value: '12', label: '12 кг' },
    { value: '25', label: '25 кг (бочка)' },
    { value: 'custom', label: 'Другой' },
];

interface Contractor {
    id: string;
    name: string;
    code?: string;
    contact_person?: string;
    phone?: string;
    email?: string;
}

export default function CreateOrderModal({ isOpen, onClose, initialMaterialId, initialQuantity, initialTransitAmount }: CreateOrderModalProps) {
    const [contractorId, setContractorId] = useState('');
    const [items, setItems] = useState<OrderItem[]>([{ itemId: '', quantity: 0, costPerUnit: 0, currency: '₴', exchangeRate: 1, tara: '' }]);
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
            if (initialMaterialId || initialQuantity) {
                setItems([{ 
                    itemId: initialMaterialId || '', 
                    quantity: initialQuantity || 0, 
                    costPerUnit: 0, 
                    currency: '₴', 
                    exchangeRate: 1, 
                    tara: '' 
                }]);
            } else {
                setItems([{ itemId: '', quantity: 0, costPerUnit: 0, currency: '₴', exchangeRate: 1, tara: '' }]);
            }
        }
    }, [isOpen, initialMaterialId, initialQuantity]);

    const loadData = async () => {
        setLoading(true);
        try {
            // Load materials
            const materialsData = await inventoryService.getItems();
            setMaterials(materialsData);

            // Load suppliers/contractors (saved to 'contractors' table during Excel import)
            if (supabase) {
                const { data, error } = await supabase
                    .from('contractors')
                    .select('id, name, code, contact_person, phone, email')
                    .order('name');

                if (error) {
                    console.error('Error loading contractors:', error);
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

    // Total in UAH: convert foreign-currency items using their exchange rate
    const totalCost = items.reduce((acc, item) => {
        const rate = item.currency !== '₴' ? (Number(item.exchangeRate) || 1) : 1;
        return acc + Number(item.quantity) * Number(item.costPerUnit) * rate;
    }, 0);

    const handleAddItem = () => {
        setItems([...items, { itemId: '', quantity: 0, costPerUnit: 0, currency: '₴', exchangeRate: 1, tara: '' }]);
    };

    const handleRemoveItem = (index: number) => {
        setItems(items.filter((_, i) => i !== index));
    };

    const handleItemChange = <K extends keyof OrderItem>(index: number, field: K, value: OrderItem[K]) => {
        const newItems = [...items];
        newItems[index][field] = value;
        setItems(newItems);
    };

    // Deduplicate materials by SKU for display
    // Implementation Plan:
    // 1. Group items by Normalized SKU (remove special chars, lowercase)
    // 2. For each SKU group, pick the "best" item (e.g. one with ID, or just first one)
    // 3. Normalized list used for Select options
    // Deduplicate materials by SKU for display
    // Implementation Plan:
    // 1. Group items by Normalized SKU (remove special chars, lowercase)
    // 2. For each SKU group, pick the "best" item (e.g. one with ID, or just first one)
    // 3. Normalized list used for Select options
    const normalizedMaterials = useMemo(() => {
        if (materials.length === 0) return [];

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
    }, [materials]);

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

            // 2. Create Order Items — price_per_unit always stored in UAH
            const orderItems = items.map(item => {
                // If price entered in foreign currency, convert to UAH
                const rate = item.currency !== '₴' ? (Number(item.exchangeRate) || 1) : 1;
                const priceUAH = Number(item.costPerUnit) * rate;
                return {
                    order_id: orderData.id,
                    item_id: item.itemId,
                    quantity: Number(item.quantity),
                    price_per_unit: priceUAH  // always UAH
                };
            });

            const { error: itemsError } = await supabase
                .from('order_items')
                .insert(orderItems);

            if (itemsError) throw itemsError;

            alert(`Заказ успешно размещен! ID: ${orderData.id.slice(0, 8)}...`);
            onClose();
            setContractorId('');
            setItems([{ itemId: '', quantity: 0, costPerUnit: 0, currency: '₴', exchangeRate: 1, tara: '' }]);
            setPrepayment(0);
            setDeliveryCost(0);

        } catch (e: unknown) {
            const errorMsg = e instanceof Error ? e.message : String(e);
            console.error('Order placement error:', e);
            alert('Ошибка при размещении заказа: ' + errorMsg);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Размещение заказа поставщику">
            <form onSubmit={handleSubmit} className="space-y-6">

                {initialTransitAmount && initialTransitAmount > 0 ? (
                    <div className="bg-blue-900/40 border border-blue-500/50 p-3 rounded-lg text-blue-200 text-sm flex items-start gap-3">
                        <span className="text-xl leading-none">📦</span>
                        <div>
                            <p className="font-semibold text-blue-100">Обратите внимание: уже в пути {initialTransitAmount.toLocaleString()}</p>
                            <p className="text-blue-300">По этому материалу уже есть ожидающие заказы в статусах "pending" или "in_progress".</p>
                        </div>
                    </div>
                ) : null}

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
                            onChange={e => setDeliveryMethod(e.target.value as typeof deliveryMethod)}
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
                        {items.map((item, index) => {
                            const selectedMaterial = normalizedMaterials.find(m => m.id === item.itemId);
                            const pricing = getPricingUnit(selectedMaterial || {});
                            const cat = (selectedMaterial?.category || '').toLowerCase();
                            const isForeignCurrency = MULTI_CURRENCY_CATEGORIES.includes(cat);
                            const isFlavor = cat === 'flavor' || cat.includes('ароматизатор');
                            // Live UAH equivalent when price entered in foreign currency
                            const uahEquiv = item.currency !== '₴' && Number(item.costPerUnit) > 0 && Number(item.exchangeRate) > 0
                                ? (Number(item.costPerUnit) * Number(item.exchangeRate))
                                : null;
                            return (
                            <div key={index} className="space-y-2 p-3 bg-slate-800/40 rounded-lg border border-slate-700/50">
                                {/* Material + delete */}
                                <div className="flex gap-2 items-end">
                                    <div className="flex-1">
                                        <Select
                                            label={index === 0 ? "Материал" : undefined}
                                            options={[
                                                { value: '', label: 'Выберите материал' },
                                                ...(searchTerm ? normalizedMaterials.filter(m =>
                                                    m.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                                    m.sku?.toLowerCase().includes(searchTerm.toLowerCase())
                                                ) : normalizedMaterials)
                                                    .map(m => ({
                                                        value: m.id,
                                                        label: `${m.sku ? `[${m.sku}] ` : ''}${m.name || 'Без названия'}`
                                                    }))
                                            ]}
                                            value={item.itemId}
                                            onChange={e => handleItemChange(index, 'itemId', e.target.value)}
                                            required
                                            disabled={loading}
                                        />
                                    </div>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        className="mb-0.5 text-red-400 hover:text-red-300 hover:bg-red-900/20 flex-shrink-0"
                                        onClick={() => handleRemoveItem(index)}
                                    >
                                        <Trash className="w-4 h-4" />
                                    </Button>
                                </div>

                                {/* Quantity + Tara + Price */}
                                <div className="flex gap-2 items-start flex-wrap">
                                    {/* Quantity */}
                                    <div className="w-28">
                                        <Input
                                            label="Кол-во"
                                            type="number"
                                            min="0"
                                            step="any"
                                            value={item.quantity}
                                            onChange={e => handleItemChange(index, 'quantity', e.target.value === '' ? '' : Number(e.target.value))}
                                            required
                                        />
                                        <p className="text-xs text-slate-500 mt-0.5">{pricing.label.replace('за ', '')}</p>
                                    </div>

                                    {/* Tara — only for flavors */}
                                    {isFlavor && (
                                        <div className="w-36">
                                            <label className="block text-sm font-medium text-slate-300 mb-1">Тара</label>
                                            <select
                                                value={item.tara || ''}
                                                onChange={e => handleItemChange(index, 'tara', e.target.value)}
                                                className="w-full h-10 bg-slate-800 border border-slate-700 text-slate-200 rounded-lg px-2 text-sm"
                                            >
                                                {FLAVOR_TARA_OPTIONS.map(o => (
                                                    <option key={o.value} value={o.value}>{o.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}

                                    {/* Price block */}
                                    <div className="flex-1 min-w-[180px] space-y-1.5">
                                        {isForeignCurrency ? (
                                            // Price + currency selector
                                            <div className="flex gap-1 items-end">
                                                <div className="flex-1">
                                                    <Input
                                                        label={`Цена (${item.currency})`}
                                                        type="number"
                                                        min="0"
                                                        step="any"
                                                        value={item.costPerUnit}
                                                        onChange={e => handleItemChange(index, 'costPerUnit', e.target.value === '' ? '' : Number(e.target.value))}
                                                        required
                                                    />
                                                </div>
                                                <div className="w-14 pb-0.5">
                                                    <select
                                                        value={item.currency}
                                                        onChange={e => handleItemChange(index, 'currency', e.target.value as '₴' | '$' | '€')}
                                                        className="w-full h-10 bg-slate-800 border border-slate-700 text-slate-200 rounded-lg px-2 text-sm"
                                                    >
                                                        <option>₴</option>
                                                        <option>$</option>
                                                        <option>€</option>
                                                    </select>
                                                </div>
                                            </div>
                                        ) : (
                                            <Input
                                                label="Цена (₴)"
                                                type="number"
                                                min="0"
                                                step="any"
                                                value={item.costPerUnit}
                                                onChange={e => handleItemChange(index, 'costPerUnit', e.target.value === '' ? '' : Number(e.target.value))}
                                                required
                                            />
                                        )}

                                        {/* Exchange rate row */}
                                        {item.currency !== '₴' && (
                                            <div className="flex gap-1 items-center">
                                                <span className="text-xs text-slate-500 whitespace-nowrap">1 {item.currency} =</span>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="any"
                                                    value={item.exchangeRate}
                                                    onChange={e => handleItemChange(index, 'exchangeRate', e.target.value === '' ? '' : Number(e.target.value))}
                                                    placeholder="Курс ₴"
                                                    className="w-24 h-7 bg-slate-800 border border-slate-700 text-slate-200 rounded px-2 text-xs"
                                                />
                                                <span className="text-xs text-slate-500">₴</span>
                                            </div>
                                        )}

                                        {/* Live UAH equivalent */}
                                        {uahEquiv !== null ? (
                                            <div className="flex items-center gap-1 px-2 py-1 bg-emerald-950/50 border border-emerald-800/40 rounded text-xs">
                                                <span className="text-slate-400">≈</span>
                                                <span className="text-emerald-400 font-semibold">
                                                    {uahEquiv.toLocaleString('uk-UA', { maximumFractionDigits: 4 })} ₴
                                                </span>
                                                <span className="text-slate-500">/ {pricing.label.replace('за ', '')}</span>
                                                <span className="text-slate-600 ml-auto italic text-[10px]">сохр. в ₴</span>
                                            </div>
                                        ) : item.itemId ? (
                                            <p className="text-xs text-slate-500">{pricing.label}</p>
                                        ) : null}
                                    </div>
                                </div>
                            </div>
                            );
                        })}
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
                            onChange={e => setPaymentTerms(e.target.value as typeof paymentTerms)}
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
