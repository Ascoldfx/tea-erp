import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import type { Recipe } from '../../types/production';
import { Package, Hash, FileText } from 'lucide-react';
import { useInventory } from '../../hooks/useInventory';

interface MaterialDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    // We can pass standardized info or raw Ids
    materialInfo: {
        itemId: string;
        name: string;
        sku: string;
        isTemp?: boolean;
    } | null;
    allRecipes: Recipe[];
    onRecipeSelect?: (recipe: Recipe) => void;
}

export default function MaterialDetailsModal({ isOpen, onClose, materialInfo, allRecipes, onRecipeSelect }: MaterialDetailsModalProps) {
    const { items } = useInventory();

    if (!materialInfo) return null;

    // Find all recipes that use this material
    const usageList = allRecipes.filter(recipe =>
        recipe.ingredients.some(ing => {
            // Match by ID
            if (ing.itemId === materialInfo.itemId) return true;
            // Or match by SKU if temp
            if (ing.tempMaterial && ing.tempMaterial.sku === materialInfo.sku) return true;
            // Or match by temp-id if applicable (though itemId check covers it usually)
            return false;
        })
    );

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Карточка Материала"
        >
            <div className="space-y-6">
                {/* Header */}
                <div className="bg-slate-900 p-4 rounded-lg border border-slate-800">
                    <div className="flex items-start gap-4">
                        <div className="p-3 bg-emerald-500/10 rounded-lg">
                            <Package className="w-8 h-8 text-emerald-500" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-slate-100">{materialInfo.name}</h3>
                            {materialInfo.sku && (
                                <div className="flex items-center gap-2 text-slate-400 mt-1">
                                    <Hash className="w-4 h-4" />
                                    <span className="font-mono">{materialInfo.sku}</span>
                                    {materialInfo.isTemp && (
                                        <span className="text-xs bg-slate-800 text-slate-500 px-2 py-0.5 rounded ml-2">Временный</span>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Usage List */}
                <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-slate-400 uppercase flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        Используется в техкартах ({usageList.length})
                    </h4>

                    {usageList.length === 0 ? (
                        <div className="text-center py-8 text-slate-500 bg-slate-900/50 rounded-lg border border-slate-800 border-dashed">
                            Этот материал не используется ни в одной техкарте.
                        </div>
                    ) : (
                        <div className="max-h-[300px] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                            {usageList.map(recipe => {
                                // Find specific ingredient details for this recipe
                                const ing = recipe.ingredients.find(i =>
                                    i.itemId === materialInfo.itemId ||
                                    (i.tempMaterial && i.tempMaterial.sku === materialInfo.sku)
                                );

                                // Determine SKU for display
                                const recipeSku = (() => {
                                    if (recipe.outputItemId?.startsWith('temp-')) return recipe.outputItemId.replace('temp-', '');
                                    const item = items.find(i => i.id === recipe.outputItemId);
                                    if (item?.sku) return item.sku;
                                    const match = recipe.description?.match(/Артикул:\s*(\d+)/i);
                                    return match ? match[1] : '';
                                })();

                                return (
                                    <div
                                        key={recipe.id}
                                        className="bg-slate-900 p-3 rounded-lg border border-slate-800 hover:border-emerald-500/50 transition-colors cursor-pointer group"
                                        onDoubleClick={() => onRecipeSelect && onRecipeSelect(recipe)}
                                        title="Двойной клик для перехода к техкарте"
                                    >
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <div className="font-medium text-slate-200 group-hover:text-emerald-400 transition-colors">{recipe.name}</div>
                                                <div className="flex items-center gap-2 mt-1">
                                                    {recipeSku && (
                                                        <span className="text-xs bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-mono border border-slate-700">
                                                            {recipeSku}
                                                        </span>
                                                    )}
                                                    <span className="text-xs text-slate-600">
                                                        {/* Optional ID display if needed, but SKU is better */}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-sm font-bold text-emerald-400">
                                                    {ing?.quantity}
                                                </div>
                                                <div className="text-[10px] text-slate-500">
                                                    норма
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="flex justify-end pt-4 border-t border-slate-800">
                    <Button onClick={onClose}>
                        Закрыть
                    </Button>
                </div>
            </div>
        </Modal>
    );
}
