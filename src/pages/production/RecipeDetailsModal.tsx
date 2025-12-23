import { useMemo, useState } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import type { Recipe } from '../../types/production';
import { FileText, Edit, Package, Hash } from 'lucide-react';
import MaterialDetailsModal from './MaterialDetailsModal';
import { useNavigate } from 'react-router-dom';
import { useInventory } from '../../hooks/useInventory';

// Функция для получения нормы текущего месяца
const getCurrentMonthNorm = (monthlyNorms?: Array<{ date: string; quantity: number }>): number | null => {
    if (!monthlyNorms || monthlyNorms.length === 0) return null;

    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

    const currentNorm = monthlyNorms.find(norm => norm.date === currentMonth);
    return currentNorm ? currentNorm.quantity : null;
};

interface RecipeDetailsModalProps {
    recipe: Recipe | null;
    allRecipes: Recipe[]; // Pass all recipes for "Where Used" search
    isOpen: boolean;
    onClose: () => void;
}

export default function RecipeDetailsModal({ recipe, allRecipes = [], isOpen, onClose }: RecipeDetailsModalProps) {
    const navigate = useNavigate();
    const { items } = useInventory();

    // Material Modal State
    const [selectedMaterial, setSelectedMaterial] = useState<{ itemId: string, name: string, sku: string, isTemp: boolean } | null>(null);
    const [isMaterialModalOpen, setIsMaterialModalOpen] = useState(false);

    const handleMaterialDoubleClick = (itemId: string, name: string, sku: string, isTemp: boolean) => {
        setSelectedMaterial({ itemId, name, sku, isTemp });
        setIsMaterialModalOpen(true);
    };


    const finishedGood = useMemo(() => {
        if (!recipe) return null;
        return items.find(i => i.id === recipe.outputItemId);
    }, [recipe, items]);


    // Парсинг количества пачек в ящике из названия
    const parsePacksPerBox = (name: string): number | null => {
        const match = name.match(/\((\d+)\)\s*$/);
        return match ? parseInt(match[1]) : null;
    };

    const formatItemName = (name: string): { displayName: string; packsPerBox: number | null } => {
        const packsPerBox = parsePacksPerBox(name);
        if (packsPerBox) {
            const baseName = name.replace(/\s*\(\d+\)\s*$/, '');
            return { displayName: baseName, packsPerBox };
        }
        return { displayName: name, packsPerBox: null };
    };

    if (!recipe) return null;

    const { displayName, packsPerBox } = formatItemName(recipe.name);

    // Извлекаем оригинальный SKU из description, если он там есть
    // Формат: "Артикул: 282157"
    let sku = finishedGood?.sku || '';
    if (!sku && recipe.description) {
        const skuMatch = recipe.description.match(/Артикул:\s*(\d+)/i);
        if (skuMatch) {
            sku = skuMatch[1];
        }
    }

    // Если все еще нет SKU и outputItemId начинается с "temp-", убираем префикс
    if (!sku && recipe.outputItemId && recipe.outputItemId.startsWith('temp-')) {
        sku = recipe.outputItemId.replace(/^temp-/, '');
    }

    // Если все еще нет SKU, используем outputItemId как есть (но не показываем "temp-")
    if (!sku && recipe.outputItemId) {
        sku = recipe.outputItemId.startsWith('temp-')
            ? recipe.outputItemId.replace(/^temp-/, '')
            : recipe.outputItemId;
    }

    const handleEdit = () => {
        onClose();
        navigate(`/production/recipes/${recipe.id}`);
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Технологическая карта"
        >
            <div className="space-y-6">
                {/* Header Info */}
                <div className="bg-slate-900 p-4 rounded-lg border border-slate-800">
                    <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                                <FileText className="w-6 h-6 text-emerald-500" />
                                <h3 className="text-xl font-semibold text-slate-100">{displayName}</h3>
                                {packsPerBox && (
                                    <span className="text-emerald-400 font-normal text-lg">
                                        ({packsPerBox} пачек в ящике)
                                    </span>
                                )}
                            </div>
                            {sku && (
                                <div className="flex items-center gap-2 text-slate-400 text-sm mt-2">
                                    <Hash className="w-4 h-4" />
                                    <span className="font-mono">Артикул: {sku}</span>
                                </div>
                            )}
                            {recipe.description && !recipe.description.includes('Артикул:') && (
                                <p className="text-sm text-slate-400 mt-3">{recipe.description}</p>
                            )}
                        </div>
                        <Button
                            variant="outline"
                            onClick={handleEdit}
                            className="ml-4"
                        >
                            <Edit className="w-4 h-4 mr-2" />
                            Редактировать
                        </Button>
                    </div>
                </div>

                {/* Recipe Info */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-900 p-4 rounded-lg border border-slate-800">
                        <div className="text-xs text-slate-500 uppercase mb-1">Базовая единица</div>
                        <div className="text-lg font-semibold text-slate-200">
                            {recipe.outputQuantity} {recipe.outputQuantity === 1 ? 'ящик' : 'ящика'}
                        </div>
                    </div>
                    <div className="bg-slate-900 p-4 rounded-lg border border-slate-800">
                        <div className="text-xs text-slate-500 uppercase mb-1">Количество ингредиентов</div>
                        <div className="text-lg font-semibold text-slate-200">
                            {recipe.ingredients.length}
                        </div>
                    </div>
                </div>

                {/* Ingredients */}
                <div className="bg-slate-900 p-4 rounded-lg border border-slate-800">
                    <div className="flex items-center gap-2 mb-4">
                        <Package className="w-5 h-5 text-emerald-500" />
                        <h4 className="text-lg font-semibold text-slate-200">
                            Ингредиенты (нормы на 1 ящик)
                        </h4>
                    </div>
                    <div className="space-y-2">
                        {recipe.ingredients.length === 0 ? (
                            <p className="text-slate-500 text-center py-4">Нет ингредиентов</p>
                        ) : (
                            <div className="overflow-x-auto overflow-y-visible min-h-[200px]">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-slate-700">
                                            <th className="text-left py-2 px-3 text-slate-400 font-semibold">Материал (Артикул)</th>
                                            <th className="text-right py-2 px-3 text-slate-400 font-semibold">Норма</th>
                                            <th className="text-left py-2 px-3 text-slate-400 font-semibold">Ед. изм.</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800">
                                        {recipe.ingredients.map((ing, idx) => {
                                            // Для временных материалов используем tempMaterial
                                            const tempMaterial = ing.tempMaterial;

                                            // Для существующих материалов ищем в items
                                            let materialSku = '';
                                            let materialName = '';

                                            // ВАЖНО: Сначала проверяем tempMaterial (для временных материалов)
                                            if (tempMaterial && tempMaterial.name) {
                                                // Временный материал - используем данные из tempMaterial
                                                materialSku = tempMaterial.sku || '';
                                                materialName = tempMaterial.name;
                                            } else {
                                                // Ищем в базе данных по itemId
                                                const foundItem = items.find(i => i.id === ing.itemId);
                                                if (foundItem && foundItem.name) {
                                                    materialSku = foundItem.sku || '';
                                                    materialName = foundItem.name;
                                                } else {
                                                    // Если не найден, пытаемся извлечь из itemId
                                                    if (ing.itemId.startsWith('temp-')) {
                                                        const tempSku = ing.itemId.replace(/^temp-/, '');
                                                        materialSku = tempSku;
                                                        materialName = `Материал ${tempSku}`; // Fallback название
                                                    } else {
                                                        materialSku = ing.itemId;
                                                        materialName = ing.itemId; // Fallback
                                                    }
                                                }
                                            }

                                            // Если название все еще пустое, используем SKU
                                            if (!materialName && materialSku) {
                                                materialName = `Материал ${materialSku}`;
                                            }

                                            const isDuplicate = ing.isDuplicateSku;
                                            const isAutoCreated = ing.isAutoCreated;

                                            // Определяем, есть ли другие ингредиенты с таким же SKU
                                            const sameSkuCount = recipe.ingredients.filter(otherIng => {
                                                if (otherIng === ing) return false;

                                                let otherSku = '';
                                                if (otherIng.tempMaterial) {
                                                    otherSku = otherIng.tempMaterial.sku;
                                                } else {
                                                    const otherItem = items.find(i => i.id === otherIng.itemId);
                                                    otherSku = otherItem?.sku || '';
                                                }

                                                return otherSku && otherSku === materialSku;
                                            }).length;

                                            // Получаем единицу измерения
                                            let unit = '';
                                            if (tempMaterial) {
                                                // Для временных материалов берем единицу из них, если есть, или '-'
                                                unit = tempMaterial.unit ? (tempMaterial.unit === 'pcs' ? 'шт' : tempMaterial.unit === 'kg' ? 'кг' : tempMaterial.unit) : '-';
                                            } else {
                                                const foundItem = items.find(i => i.id === ing.itemId);
                                                if (foundItem) {
                                                    unit = foundItem.unit === 'pcs' ? 'шт' : foundItem.unit === 'kg' ? 'кг' : foundItem.unit || '-';
                                                } else {
                                                    unit = '-';
                                                }
                                            }

                                            // Логика расчета отображаемой нормы
                                            const hasMonthlyNorms = ing.monthlyNorms && ing.monthlyNorms.length > 0;
                                            const currentNorm = getCurrentMonthNorm(ing.monthlyNorms);

                                            // Определяем "эффективную" норму для отображения
                                            let effectiveNorm = 0;
                                            let normSource: 'etalon' | 'monthly_current' | 'monthly_fallback' | 'none' = 'none';
                                            let normDate = '';

                                            if (currentNorm !== null && currentNorm > 0) {
                                                effectiveNorm = currentNorm;
                                                normSource = 'monthly_current';
                                            } else if (ing.quantity > 0) {
                                                effectiveNorm = ing.quantity;
                                                normSource = 'etalon';
                                            } else if (hasMonthlyNorms) {
                                                // Если текущего месяца нет, берем первый доступный (fallback)
                                                // Сортируем по дате, чтобы взять ближайший
                                                const sortedNorms = [...ing.monthlyNorms!].sort((a, b) => a.date.localeCompare(b.date));
                                                // Ищем первый ненулевой
                                                const firstNonZero = sortedNorms.find(n => n.quantity > 0);

                                                if (firstNonZero) {
                                                    effectiveNorm = firstNonZero.quantity;
                                                    normSource = 'monthly_fallback';
                                                    normDate = firstNonZero.date;
                                                }
                                            }

                                            return (
                                                <tr
                                                    key={idx}
                                                    className={`hover:bg-slate-800/50 cursor-pointer transition-colors ${isDuplicate || sameSkuCount > 0
                                                        ? 'bg-yellow-500/10 border-l-2 border-yellow-500'
                                                        : ''
                                                        } ${isAutoCreated
                                                            ? 'bg-blue-500/10 border-l-2 border-blue-500'
                                                            : ''
                                                        }`}
                                                    onDoubleClick={(e) => {
                                                        e.stopPropagation(); // Prevent bubbling if needed
                                                        handleMaterialDoubleClick(
                                                            ing.itemId,
                                                            materialName,
                                                            materialSku,
                                                            !!tempMaterial || ing.itemId.startsWith('temp-')
                                                        );
                                                    }}
                                                    title="Двойной клик для просмотра использования"
                                                >
                                                    <td className="py-2 px-3 text-slate-200">
                                                        <div className="flex flex-col gap-1">
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <span className={tempMaterial ? 'text-slate-400 italic' : ''}>
                                                                    {materialName}
                                                                </span>
                                                                {materialSku && (
                                                                    <span className="text-slate-400 font-mono text-xs">
                                                                        ({materialSku}{tempMaterial ? ' - временный' : ''})
                                                                    </span>
                                                                )}
                                                                {isAutoCreated && (
                                                                    <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded">
                                                                        Создан
                                                                    </span>
                                                                )}
                                                                {(isDuplicate || sameSkuCount > 0) && (
                                                                    <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded">
                                                                        Дубликат ({sameSkuCount + 1})
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="py-2 px-3 text-right text-slate-200 font-medium">
                                                        {effectiveNorm > 0 ? (
                                                            <div className="flex flex-col items-end">
                                                                <span className={`font-bold ${normSource === 'monthly_current' ? 'text-emerald-400' :
                                                                    normSource === 'monthly_fallback' ? 'text-amber-400' :
                                                                        'text-slate-200'
                                                                    }`}>
                                                                    {effectiveNorm.toFixed(4)}
                                                                    {normSource !== 'etalon' && '*'}
                                                                </span>
                                                                {normSource === 'monthly_fallback' && (
                                                                    <span className="text-[10px] text-slate-500">
                                                                        (из плана на {new Date(normDate).toLocaleDateString('ru-RU', { month: 'short', year: '2-digit' })})
                                                                    </span>
                                                                )}
                                                                {normSource === 'monthly_current' && (
                                                                    <span className="text-[10px] text-emerald-500/70">
                                                                        (текущий месяц)
                                                                    </span>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <span className="text-slate-500 text-xs">—</span>
                                                        )}
                                                    </td>
                                                    <td className="py-2 px-3 text-slate-400">
                                                        {unit}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>

                {/* Additional Info */}
                {(recipe.materialsHandoverDate || recipe.materialsAcceptedDate) && (
                    <div className="bg-slate-900 p-4 rounded-lg border border-slate-800">
                        <h4 className="text-sm font-semibold text-slate-400 uppercase mb-3">Дополнительная информация</h4>
                        <div className="space-y-2 text-sm">
                            {recipe.materialsHandoverDate && (
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Дата передачи материалов:</span>
                                    <span className="text-slate-200">
                                        {new Date(recipe.materialsHandoverDate).toLocaleDateString('ru-RU')}
                                    </span>
                                </div>
                            )}
                            {recipe.materialsAcceptedDate && (
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Дата принятия материалов:</span>
                                    <span className="text-slate-200">
                                        {new Date(recipe.materialsAcceptedDate).toLocaleDateString('ru-RU')}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Footer */}
                <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                    <Button variant="outline" onClick={onClose}>
                        Закрыть
                    </Button>
                    <Button onClick={handleEdit} className="bg-emerald-600 hover:bg-emerald-700">
                        <Edit className="w-4 h-4 mr-2" />
                        Редактировать
                    </Button>
                </div>
            </div>
        </Modal>

        {/* Material Details Modal */ }
    <MaterialDetailsModal
        isOpen={isMaterialModalOpen}
        onClose={() => setIsMaterialModalOpen(false)}
        materialInfo={selectedMaterial}
        allRecipes={allRecipes}
    />
        </>
    );
}

