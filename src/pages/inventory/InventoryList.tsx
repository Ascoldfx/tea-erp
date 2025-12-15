import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Modal } from '../../components/ui/Modal';
import { ShoppingCart, AlertTriangle, Loader2 } from 'lucide-react';
import MaterialDetailsModal from './MaterialDetailsModal';
import ReceiveGoodsModal from './ReceiveGoodsModal';
import CreateOrderModal from './CreateOrderModal';
import type { InventoryItem, StockLevel } from '../../types/inventory';
import { clsx } from 'clsx';
import { useAuth } from '../../context/AuthContext';
import { useInventory } from '../../hooks/useInventory';
import ExcelImportModal from './ExcelImportModal';

export default function InventoryList() {
    const { hasPermission, user } = useAuth();
    // Use Hook to fetch data (Real DB or Mock Fallback)
    const { items, warehouses, stock, loading } = useInventory();

    const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
    const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);
    const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState<(InventoryItem & { totalStock: number; stockLevels: StockLevel[] }) | null>(null);
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);

    // Filtering
    const [selectedWarehouseId, setSelectedWarehouseId] = useState<string | null>(null);

    const [transferData, setTransferData] = useState({
        sourceWarehouseId: '',
        targetWarehouseId: '',
        itemId: '',
        quantity: 0
    });

    const inventoryCombined = useMemo(() => {
        return items.map(item => {
            // Get ALL stock levels for this item (for the Details Modal)
            const allStockLevels = stock.filter(s => s.itemId === item.id);

            // Calculate stock for the CURRENT view (filtered by warehouse)
            const relevantStockLevels = selectedWarehouseId
                ? allStockLevels.filter(s => s.warehouseId === selectedWarehouseId)
                : allStockLevels;

            const totalStock = relevantStockLevels.reduce((acc, curr) => acc + curr.quantity, 0);

            return {
                ...item,
                totalStock, // Use this for the list column "Total Stock"
                stockLevels: allStockLevels // Pass FULL data to the modal
            };
        }).filter(item => !selectedWarehouseId || item.totalStock > 0); // Hide items with 0 stock in the selected warehouse
    }, [selectedWarehouseId, items, stock]);

    if (loading) {
        return (
            <div className="flex h-96 items-center justify-center text-slate-500">
                <Loader2 className="w-8 h-8 animate-spin mr-2" />
                Загрузка склада...
            </div>
        );
    }

    // ... existing handlers ...

    const handleTransfer = (e: React.FormEvent) => {
        e.preventDefault();
        console.log('Transferring stock:', transferData);
        alert(`Перемещение успешно! (Эмуляция)\n${transferData.quantity} ед. перемещено.`);
        setIsTransferModalOpen(false);
        setTransferData({ sourceWarehouseId: '', targetWarehouseId: '', itemId: '', quantity: 0 });
    };

    const handleItemClick = (item: typeof inventoryCombined[0]) => {
        setSelectedItem(item);
        setIsDetailsModalOpen(true);
    };

    // ... existing renderLocationBadges ...
    const renderLocationBadges = (stockLevels: StockLevel[]) => {
        // We only want to show badges for warehouses that actually have stock
        const relevantStock = stockLevels.filter(s => s.quantity > 0);

        // If filtering is active, maybe we only want to show that badge? 
        // User asked for "full info in modal", but didn't specify list behavior changes other than duplicates.
        // Let's keep showing all badges for now, or filter if that's cleaner. 
        // Actually context: "when clicking... show all info". The list row can show all or just relevant.
        // Let's show relevant badges to the filter if selected, or all if not.
        const displayStock = selectedWarehouseId
            ? relevantStock.filter(s => s.warehouseId === selectedWarehouseId)
            : relevantStock;

        const locations = displayStock.map(s => {
            const wh = warehouses.find(w => w.id === s.warehouseId);
            return { id: s.warehouseId, name: wh?.name || s.warehouseId, type: wh?.id.includes('prod') ? 'prod' : wh?.id.includes('contractor') ? 'contractor' : 'main' };
        });

        if (locations.length === 0) return <span className="text-slate-600 text-xs italic">Нет на остатке</span>;

        return (
            <div className="flex flex-wrap gap-1">
                {locations.map(loc => (
                    <span key={loc.id} className={clsx(
                        "px-1.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider",
                        loc.type === 'prod' ? "bg-blue-900/40 text-blue-400 border border-blue-800" :
                            loc.type === 'contractor' ? "bg-amber-900/40 text-amber-400 border border-amber-800" :
                                "bg-slate-700 text-slate-300 border border-slate-600"
                    )}>
                        {loc.type === 'prod' ? 'В ЦЕХУ' : loc.type === 'contractor' ? 'У ПОДРЯДЧИКА' : 'СКЛАД'}
                    </span>
                ))}
            </div>
        );
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-slate-100">Материалы</h1>
                    <p className="text-slate-400 mt-1">Управление запасами сырья, упаковки и материалов</p>
                </div>
                <div className="flex gap-4 items-center">
                    {(user?.role === 'admin' || user?.role === 'procurement') && (
                        <Button onClick={() => setIsOrderModalOpen(true)} className="bg-blue-600 hover:bg-blue-700 h-12 px-6 text-lg shadow-lg shadow-blue-900/20">
                            <ShoppingCart className="w-5 h-5 mr-2" />
                            Создать заказ
                        </Button>
                    )}
                </div>
            </div>

            <div className="flex gap-2 pb-2 overflow-x-auto">
                <button
                    onClick={() => setSelectedWarehouseId(null)}
                    className={clsx(
                        "px-4 py-2 rounded-full text-sm font-medium transition-colors border",
                        !selectedWarehouseId ? "bg-slate-100 text-slate-900 border-slate-100" : "bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-500"
                    )}
                >
                    Все склады
                </button>
                {warehouses.map(w => (
                    <button
                        key={w.id}
                        onClick={() => setSelectedWarehouseId(w.id)}
                        className={clsx(
                            "px-4 py-2 rounded-full text-sm font-medium transition-colors border whitespace-nowrap",
                            selectedWarehouseId === w.id ? "bg-emerald-600 text-white border-emerald-500" : "bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-500"
                        )}
                    >
                        {w.name}
                    </button>
                ))}
            </div>

            {/* List Groups */}
            {['tea_bulk', 'flavor', 'packaging'].map(group => {
                const groupTitle = group === 'tea_bulk' ? 'Чайное сырье' : group === 'flavor' ? 'Ароматизаторы' : 'Упаковка и расходники';
                const itemsInGroup = inventoryCombined.filter(item => {
                    if (group === 'packaging') {
                        return ['packaging_consumable', 'packaging_box', 'packaging_crate', 'label'].includes(item.category);
                    }
                    return item.category === group;
                });

                if (itemsInGroup.length === 0) return null;

                return (
                    <Card key={group}>
                        <CardHeader>
                            <CardTitle>{groupTitle}</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            {/* ... table ... */}
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-slate-900 border-b border-slate-800">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Код</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Наименование</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Местонахождение</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Общий остаток</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Ед. изм.</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Статус</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800">
                                        {itemsInGroup.map(item => {
                                            const isLowStock = item.totalStock <= item.minStockLevel;
                                            return (
                                                <tr
                                                    key={item.id}
                                                    className="hover:bg-slate-800/50 transition-colors cursor-pointer group"
                                                    onClick={() => handleItemClick(item)}
                                                >
                                                    <td className="px-6 py-4 whitespace-nowrap text-slate-400 font-mono text-xs">
                                                        {item.sku}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap font-medium text-slate-200 group-hover:text-emerald-400 transition-colors">
                                                        {item.name}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        {renderLocationBadges(item.stockLevels)}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-slate-200">
                                                        {item.totalStock}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-slate-500">{item.unit}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        {isLowStock ? (
                                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-900/30 text-red-400">
                                                                <AlertTriangle className="w-3 h-3 mr-1" />
                                                                Мало
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-900/30 text-emerald-400">
                                                                В норме
                                                            </span>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                );
            })}

            {/* Modals */}
            <ExcelImportModal
                isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
            />
            <Modal
                isOpen={isTransferModalOpen}
                onClose={() => setIsTransferModalOpen(false)}
                title="Перемещение материалов"
            >
                {/* ... existing modal ... */}
                <form onSubmit={handleTransfer} className="space-y-4">
                    <Select
                        label="Откуда"
                        options={[
                            { value: '', label: 'Выберите склад...' },
                            ...warehouses.map(w => ({ value: w.id, label: w.name }))
                        ]}
                        value={transferData.sourceWarehouseId}
                        onChange={e => setTransferData({ ...transferData, sourceWarehouseId: e.target.value })}
                        required
                    />
                    <Select
                        label="Куда"
                        options={[
                            { value: '', label: 'Выберите склад...' },
                            ...warehouses.map(w => ({ value: w.id, label: w.name }))
                        ]}
                        value={transferData.targetWarehouseId}
                        onChange={e => setTransferData({ ...transferData, targetWarehouseId: e.target.value })}
                        required
                    />
                    <Select
                        label="Материал"
                        options={[
                            { value: '', label: 'Выберите материал...' },
                            ...items.map(i => ({ value: i.id, label: i.name }))
                        ]}
                        value={transferData.itemId}
                        onChange={e => setTransferData({ ...transferData, itemId: e.target.value })}
                        required
                    />
                    <Input
                        label="Количество"
                        type="number"
                        min="1"
                        value={transferData.quantity}
                        onChange={e => setTransferData({ ...transferData, quantity: parseInt(e.target.value) || 0 })}
                        required
                    />
                    <div className="flex justify-end gap-3 pt-4">
                        <Button type="button" variant="ghost" onClick={() => setIsTransferModalOpen(false)}>
                            Отмена
                        </Button>
                        <Button type="submit">
                            Подтвердить
                        </Button>
                    </div>
                </form>
            </Modal>

            <MaterialDetailsModal
                isOpen={isDetailsModalOpen}
                onClose={() => setIsDetailsModalOpen(false)}
                item={selectedItem}
            />
            {isReceiveModalOpen && (
                <ReceiveGoodsModal
                    isOpen={isReceiveModalOpen}
                    onClose={() => setIsReceiveModalOpen(false)}
                />
            )}
            {isOrderModalOpen && (
                <CreateOrderModal
                    isOpen={isOrderModalOpen}
                    onClose={() => setIsOrderModalOpen(false)}
                />
            )}
        </div>
    );
}
