import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Modal } from '../../components/ui/Modal';
import { ShoppingCart, Loader2, Trash2, Filter } from 'lucide-react';
import MaterialDetailsModal from './MaterialDetailsModal';
import ReceiveGoodsModal from './ReceiveGoodsModal';
import CreateOrderModal from './CreateOrderModal';
import type { InventoryItem, StockLevel } from '../../types/inventory';
import { clsx } from 'clsx';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useInventory } from '../../hooks/useInventory';
import ExcelImportModal from './ExcelImportModal';
import { inventoryService } from '../../services/inventoryService';
import type { InventoryCategory } from '../../types/inventory';

export default function InventoryList() {
    const { user } = useAuth();
    const { t, language } = useLanguage();
    // Use Hook to fetch data (Real DB or Mock Fallback)
    const { items, warehouses, stock, loading, refresh } = useInventory();

    const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
    const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);
    const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState<(InventoryItem & { totalStock: number; stockLevels: StockLevel[] }) | null>(null);
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<(InventoryItem & { totalStock: number; stockLevels: StockLevel[] }) | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // Filtering
    const [selectedWarehouseId, setSelectedWarehouseId] = useState<string | null>(null);
    const [selectedCategory, setSelectedCategory] = useState<InventoryCategory | 'all'>('all');

    const [transferData, setTransferData] = useState({
        sourceWarehouseId: '',
        targetWarehouseId: '',
        itemId: '',
        quantity: 0
    });

    // Get all unique categories from items (including dynamic ones)
    const allCategories = useMemo(() => {
        const categories = [...new Set(items.map(item => item.category))];
        return categories.sort();
    }, [items]);

    // All categories are now dynamic (from database)
    // No standard categories - everything comes from imported data
    const dynamicCategories = useMemo(() => {
        return allCategories;
    }, [allCategories]);

    // Helper function to format category name for display
    const formatCategoryName = (category: string): string => {
        // Try to get translation first
        const translationKey = `materials.filter.${category}`;
        const translated = t(translationKey);
        if (translated !== translationKey) {
            return translated;
        }
        
        // Map common English category names to Russian/Ukrainian
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
            'packaging_cardboard': language === 'uk' ? 'Картонна упаковка' : 'Картонная упаковка',
            'packaging_box': language === 'uk' ? 'Коробки та пачки' : 'Коробки и пачки'
        };
        
        // Check if we have a mapping for this category
        if (categoryMap[category]) {
            return categoryMap[category];
        }
        
        // If no translation or mapping, format the category name nicely
        // Replace underscores with spaces and capitalize words
        return category
            .replace(/_/g, ' ')
            .replace(/\b\w/g, (char) => char.toUpperCase())
            .trim();
    };

    const inventoryCombined = useMemo(() => {
        const mapped = items.map(item => {
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
        });
        
        // Debug: log categories for troubleshooting
        if (selectedCategory !== 'all' && mapped.length > 0) {
            const categories = [...new Set(mapped.map(i => i.category))];
            console.log(`[Filter Debug] Selected category: ${selectedCategory}, Available categories:`, categories);
        }
        
        return mapped.filter(item => {
            // Filter by warehouse
            if (selectedWarehouseId && item.totalStock === 0) return false;
            
            // Filter by category
            if (selectedCategory === 'all') return true;
            
            // Exact match for specific categories
            const matches = item.category === selectedCategory;
            if (!matches && selectedCategory === 'flavor') {
                // Debug: log items that should be flavor but aren't
                console.log(`[Filter Debug] Item "${item.name}" (category: ${item.category}) doesn't match flavor filter. Expected: flavor, got: ${item.category}`);
            }
            return matches;
        });
    }, [selectedWarehouseId, selectedCategory, items, stock]);

    const handleDeleteItem = async () => {
        if (!itemToDelete) return;

        setIsDeleting(true);
        try {
            await inventoryService.deleteItem(itemToDelete.id);
            await refresh(); // Refresh the list
            setItemToDelete(null);
        } catch (error) {
            console.error('Error deleting item:', error);
            alert(t('materials.deleteConfirm') + ' ' + t('common.error') || 'Ошибка при удалении материала. Попробуйте еще раз.');
        } finally {
            setIsDeleting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex h-96 items-center justify-center text-slate-500">
                <Loader2 className="w-8 h-8 animate-spin mr-2" />
                {t('common.loading')}
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
    const renderLocationBadges = (stockLevels: StockLevel[], item?: InventoryItem) => {
        // If item has storage_location from Excel, show it
        if (item?.storage_location) {
            return (
                <span className="text-slate-300 text-xs">
                    {item.storage_location}
                </span>
            );
        }

        // Otherwise, show warehouse badges
        // We only want to show badges for warehouses that actually have stock
        const relevantStock = stockLevels.filter(s => s.quantity > 0);

        const displayStock = selectedWarehouseId
            ? relevantStock.filter(s => s.warehouseId === selectedWarehouseId)
            : relevantStock;

        const locations = displayStock.map(s => {
            const wh = warehouses.find(w => w.id === s.warehouseId);
            // Determine type based on warehouse type field or fallback to ID/name pattern
            let type: 'main' | 'prod' | 'contractor' | 'supplier' = 'main';
            if (wh?.type === 'supplier' || wh?.type === 'contractor') {
                type = wh.type === 'supplier' ? 'supplier' : 'contractor';
            } else if (wh?.id === 'wh-ceh' || wh?.name === 'Цех' || wh?.id.includes('ceh')) {
                type = 'prod';
            } else if (wh?.id.includes('contractor') || wh?.id.includes('supplier')) {
                type = wh.id.includes('supplier') ? 'supplier' : 'contractor';
            }
            return { 
                id: s.warehouseId, 
                name: wh?.name || s.warehouseId, 
                type,
                contractorId: wh?.contractor_id
            };
        });

        if (locations.length === 0) {
            return <span className="text-slate-600 text-xs italic">{t('materials.status.low')}</span>;
        }

        return (
            <div className="flex flex-wrap gap-1">
                {locations.map(loc => (
                    <span key={loc.id} className={clsx(
                        "px-1.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider",
                        loc.type === 'prod' ? "bg-blue-900/40 text-blue-400 border border-blue-800" :
                            loc.type === 'contractor' ? "bg-amber-900/40 text-amber-400 border border-amber-800" :
                                loc.type === 'supplier' ? "bg-purple-900/40 text-purple-400 border border-purple-800" :
                                    "bg-slate-700 text-slate-300 border border-slate-600"
                    )}
                        title={loc.name}
                    >
                        {loc.type === 'prod' ? t('materials.location.prod') : 
                         loc.type === 'contractor' ? t('materials.location.contractor') :
                         loc.type === 'supplier' ? t('materials.location.supplier') :
                         t('materials.location.main')}
                    </span>
                ))}
            </div>
        );
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-slate-100">{t('materials.title')}</h1>
                    <p className="text-slate-400 mt-1">{t('materials.subtitle')}</p>
                </div>
                <div className="flex gap-4 items-center">
                    {(user?.role === 'admin' || user?.role === 'procurement') && (
                        <Button onClick={() => setIsOrderModalOpen(true)} className="bg-blue-600 hover:bg-blue-700 h-12 px-6 text-lg shadow-lg shadow-blue-900/20">
                            <ShoppingCart className="w-5 h-5 mr-2" />
                            {t('materials.createOrder')}
                        </Button>
                    )}
                </div>
            </div>

            {/* Warehouse Filter */}
            <div className="flex gap-2 pb-2 overflow-x-auto">
                <button
                    onClick={() => setSelectedWarehouseId(null)}
                    className={clsx(
                        "px-4 py-2 rounded-full text-sm font-medium transition-colors border",
                        !selectedWarehouseId ? "bg-slate-100 text-slate-900 border-slate-100" : "bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-500"
                    )}
                >
                    {t('materials.filter.allGroups').replace('группы', 'склады') || 'Всі склади'}
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

            {/* Category Filter - Only Dynamic Categories from Database */}
            <div className="flex flex-wrap gap-2 pb-4 items-center">
                <Filter className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <span className="text-sm text-slate-400 mr-2 flex-shrink-0">{t('materials.filter.group')}:</span>
                
                {/* All Groups Button */}
                <button
                    onClick={() => setSelectedCategory('all')}
                    className={clsx(
                        "px-3 py-1 rounded-full text-sm font-medium transition-colors flex-shrink-0",
                        selectedCategory === 'all' ? "bg-blue-600 text-white border-blue-500" : "bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-500"
                    )}
                >
                    {t('materials.filter.allGroups')}
                </button>
                
                {/* Dynamic Category Buttons (all categories from database) */}
                {dynamicCategories.length > 0 ? (
                    dynamicCategories.map(category => {
                        const label = formatCategoryName(category);
                        return (
                            <button
                                key={category}
                                onClick={() => setSelectedCategory(category)}
                                className={clsx(
                                    "px-3 py-1 rounded-full text-sm font-medium transition-colors flex-shrink-0 border",
                                    selectedCategory === category ? "bg-blue-600 text-white border-blue-500" : "bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-500"
                                )}
                                title={`Категория: ${category}`}
                            >
                                {label}
                            </button>
                        );
                    })
                ) : (
                    <span className="text-sm text-slate-500 italic px-3">
                        {t('materials.filter.noCategories') || 'Нет категорий. Импортируйте материалы из Excel.'}
                    </span>
                )}
            </div>

            {/* List Groups */}
            {(() => {
                // Determine which groups to show based on filter
                let groupsToShow: Array<'tea_bulk' | 'flavor' | 'packaging_consumable' | 'packaging_box' | 'packaging_crate' | 'label' | 'sticker' | 'soft_packaging' | 'envelope' | 'other'> = [];
                
                if (selectedCategory === 'all') {
                    // Show all groups when "all" is selected (including dynamic categories)
                    groupsToShow = allCategories as any[];
                } else {
                    // Show only the selected category group (can be standard or dynamic)
                    groupsToShow = [selectedCategory as any];
                }

                return groupsToShow.map(group => {
                    // Get group title - try translation first, then format dynamic category
                    let groupTitle: string;
                    const translationKey = `materials.group.${group}`;
                    const translated = t(translationKey);
                    
                    if (translated !== translationKey) {
                        // Standard category with translation
                        groupTitle = translated;
                    } else {
                        // Dynamic category - format the name
                        groupTitle = formatCategoryName(group);
                    }
                    
                    const itemsInGroup = inventoryCombined.filter(item => {
                        // Exact match for the group category
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
                                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">{t('materials.code')}</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">{t('materials.name')}</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">{t('materials.location')}</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">{t('materials.totalStock')}</th>
                                            {(user?.role === 'admin' || user?.role === 'procurement') && (
                                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">{t('materials.actions')}</th>
                                            )}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800">
                                        {itemsInGroup.map(item => {
                                            return (
                                                <tr
                                                    key={item.id}
                                                    className="hover:bg-slate-800/50 transition-colors group"
                                                >
                                                    <td 
                                                        className="px-6 py-4 whitespace-nowrap text-slate-400 font-mono text-xs cursor-pointer"
                                                        onClick={() => handleItemClick(item)}
                                                    >
                                                        {item.sku}
                                                    </td>
                                                    <td 
                                                        className="px-6 py-4 whitespace-nowrap font-medium text-slate-200 group-hover:text-emerald-400 transition-colors cursor-pointer"
                                                        onClick={() => handleItemClick(item)}
                                                    >
                                                        {item.name}
                                                    </td>
                                                    <td 
                                                        className="px-6 py-4 whitespace-nowrap cursor-pointer"
                                                        onClick={() => handleItemClick(item)}
                                                    >
                                                        {renderLocationBadges(item.stockLevels, item)}
                                                    </td>
                                                    <td 
                                                        className="px-6 py-4 whitespace-nowrap text-slate-200 cursor-pointer"
                                                        onClick={() => handleItemClick(item)}
                                                    >
                                                        {item.totalStock} {item.unit === 'pcs' ? 'шт' : item.unit}
                                                    </td>
                                                    {(user?.role === 'admin' || user?.role === 'procurement') && (
                                                        <td 
                                                            className="px-6 py-4 whitespace-nowrap"
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            <button
                                                                onClick={() => setItemToDelete(item)}
                                                                className="text-red-400 hover:text-red-300 transition-colors p-2 hover:bg-red-900/20 rounded"
                                                                           title={t('materials.deleteMaterial')}
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </td>
                                                    )}
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                );
            })})()}

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

            {/* Delete Confirmation Modal */}
            <Modal
                isOpen={!!itemToDelete}
                onClose={() => setItemToDelete(null)}
                title={t('common.delete') + ' - ' + t('materials.title')}
            >
                <div className="space-y-4">
                    <p className="text-slate-300">
                        {t('materials.deleteConfirm')} <strong className="text-slate-100">{itemToDelete?.name}</strong>?
                    </p>
                    <p className="text-sm text-slate-400">
                        {t('materials.code')}: <span className="font-mono">{itemToDelete?.sku}</span>
                    </p>
                    <p className="text-sm text-red-400">
                        ⚠️ {t('materials.deleteWarning')}
                    </p>
                    <div className="flex justify-end gap-3 pt-4">
                        <Button 
                            type="button" 
                            variant="ghost" 
                            onClick={() => setItemToDelete(null)}
                            disabled={isDeleting}
                        >
                            {t('common.cancel')}
                        </Button>
                        <Button 
                            type="button"
                            onClick={handleDeleteItem}
                            disabled={isDeleting}
                            className="bg-red-600 hover:bg-red-700 text-white"
                        >
                            {isDeleting ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    {t('common.loading')}
                                </>
                            ) : (
                                <>
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    {t('common.delete')}
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
