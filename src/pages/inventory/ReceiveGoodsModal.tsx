import { useState } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { useInventory } from '../../hooks/useInventory';
// import { MOCK_CONTRACTORS } from '../../data/mockContractors';
const MOCK_CONTRACTORS: any[] = [];
import { Plus, Trash, CheckCircle } from 'lucide-react';

interface ReceiveGoodsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

interface OrderItem {
    itemId: string;
    quantity: number;
    costWithVat: number;
}

export default function ReceiveGoodsModal({ isOpen, onClose }: ReceiveGoodsModalProps) {
    const [contractorId, setContractorId] = useState('');
    const [warehouseId, setWarehouseId] = useState('');
    // Defaulting warehouse to "Main Stock" if possible, otherwise empty
    // costWithVat: cost per unit including VAT
    const { items: inventoryItems, warehouses } = useInventory();
    const [items, setItems] = useState<OrderItem[]>([{ itemId: '', quantity: 0, costWithVat: 0 }]);

    // Logistics Only
    const [specificationNumber, setSpecificationNumber] = useState('');

    const handleAddItem = () => {
        setItems([...items, { itemId: '', quantity: 0, costWithVat: 0 }]);
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

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const contractor = MOCK_CONTRACTORS.find(c => c.id === contractorId)?.name;

        const summary = [
            `МАТЕРИАЛЫ ПРИНЯТЫ`,
            `Поставщик: ${contractor}`,
            `Спецификация: ${specificationNumber || 'Не указана'}`,
            `Склад: ${warehouses.find(w => w.id === warehouseId)?.name}`,
            `Позиций: ${items.length}`
        ].join('\n');

        alert(summary);
        onClose();
        // Reset
        setContractorId('');
        setItems([{ itemId: '', quantity: 0, costWithVat: 0 }]);
        setSpecificationNumber('');
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Приемка материалов (Склад)">
            <form onSubmit={handleSubmit} className="space-y-6">

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Select
                        label="Поставщик"
                        options={[
                            { value: '', label: 'Выберите поставщика...' },
                            ...MOCK_CONTRACTORS.map(c => ({ value: c.id, label: c.name }))
                        ]}
                        value={contractorId}
                        onChange={e => setContractorId(e.target.value)}
                        required
                    />
                    <Select
                        label="На Склад"
                        options={[
                            { value: '', label: 'Выберите склад...' },
                            ...warehouses.map(w => ({ value: w.id, label: w.name }))
                        ]}
                        value={warehouseId}
                        onChange={e => setWarehouseId(e.target.value)}
                        required
                    />
                </div>

                <div className="grid grid-cols-1 gap-4">
                    <Input
                        label="Номер документа (Спецификация / Накладная)"
                        placeholder="№ Накладной"
                        value={specificationNumber}
                        onChange={e => setSpecificationNumber(e.target.value)}
                    />
                </div>

                {/* Items List */}
                <div className="space-y-3">
                    <div className="flex justify-between items-center">
                        <h4 className="text-sm font-medium text-slate-300">Список материалов</h4>
                        <Button type="button" variant="ghost" size="sm" onClick={handleAddItem}>
                            <Plus className="w-4 h-4 mr-1" /> Добавить
                        </Button>
                    </div>
                    {items.map((item, index) => (
                        <div key={index} className="flex gap-2 items-end">
                            <div className="flex-1">
                                <Select
                                    label={index === 0 ? "Материал" : undefined}
                                    options={[
                                        { value: '', label: 'Выбрать...' },
                                        ...inventoryItems.map(i => ({ value: i.id, label: i.name }))
                                    ]}
                                    value={item.itemId}
                                    onChange={e => handleItemChange(index, 'itemId', e.target.value)}
                                    required
                                />
                            </div>
                            <div className="w-24">
                                <Input
                                    label={index === 0 ? "Кол-во" : undefined}
                                    type="number"
                                    min="0"
                                    value={item.quantity}
                                    onChange={e => handleItemChange(index, 'quantity', Number(e.target.value))}
                                    required
                                />
                            </div>
                            <div className="w-32">
                                <Input
                                    label={index === 0 ? "Стоимость (с НДС)" : undefined}
                                    type="number"
                                    min="0"
                                    value={item.costWithVat}
                                    onChange={e => handleItemChange(index, 'costWithVat', Number(e.target.value))}
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

                <div className="flex justify-end gap-3 pt-4">
                    <Button type="button" variant="ghost" onClick={onClose}>
                        Отмена
                    </Button>
                    <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-lg px-8 py-2">
                        <CheckCircle className="w-5 h-5 mr-2" />
                        Принять материалы
                    </Button>
                </div>
            </form>
        </Modal>
    );
}
