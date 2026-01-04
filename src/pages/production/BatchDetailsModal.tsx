import type { ProductionBatch } from '../../types/production';
// import { MOCK_RECIPES } from '../../data/mockProduction';
const MOCK_RECIPES: any[] = [];
import { Modal } from '../../components/ui/Modal';
import { clsx } from 'clsx';

interface BatchDetailsModalProps {
    batch: ProductionBatch | null;
    isOpen: boolean;
    onClose: () => void;
}

export default function BatchDetailsModal({ batch, isOpen, onClose }: BatchDetailsModalProps) {
    if (!batch) return null;

    const recipe = MOCK_RECIPES.find(r => r.id === batch.recipeId);

    // Helper to format ISO date string
    const formatTime = (dateStr?: string) => {
        if (!dateStr) return '---';
        return new Date(dateStr).toLocaleString('ru-RU', {
            day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
        });
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Партия ${batch.id}`}>
            <div className="space-y-6">
                {/* Header Info */}
                <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
                    <h3 className="text-lg font-semibold text-slate-100 mb-1">{recipe?.name || 'Неизвестный рецепт'}</h3>
                    <div className="grid grid-cols-2 gap-4 mt-4 text-sm">
                        <div>
                            <p className="text-slate-400">Статус:</p>
                            <span className={clsx(
                                'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium mt-1',
                                batch.status === 'completed' ? 'bg-emerald-900/30 text-emerald-400' :
                                    batch.status === 'in_progress' ? 'bg-blue-900/30 text-blue-400' :
                                        'bg-slate-700 text-slate-300'
                            )}>
                                {batch.status === 'completed' ? 'Завершен' :
                                    batch.status === 'in_progress' ? 'В работе' : 'Планируется'}
                            </span>
                        </div>
                        <div>
                            <p className="text-slate-400">План / Факт:</p>
                            <p className="text-slate-200 mt-1">
                                {batch.targetQuantity} / <span className="font-semibold">{batch.producedQuantity || 0}</span>
                            </p>
                        </div>
                    </div>
                </div>

                {/* Timeline */}
                <div>
                    <h4 className="text-sm font-medium text-slate-400 uppercase mb-4">Хронология производства</h4>
                    <div className="relative pl-4 border-l-2 border-slate-800 space-y-8">
                        {/* Step 1: Handover */}
                        <div className="relative">
                            <div className={clsx(
                                "absolute -left-[21px] top-0 w-4 h-4 rounded-full border-2",
                                batch.materialsHandoverDate ? "bg-emerald-500 border-emerald-500" : "bg-slate-900 border-slate-600"
                            )} />
                            <div className="flex flex-col">
                                <span className="text-sm font-medium text-slate-200">Передача материалов</span>
                                <span className="text-xs text-slate-500">{formatTime(batch.materialsHandoverDate)}</span>
                                {!batch.materialsHandoverDate && (
                                    <span className="text-xs text-amber-500 mt-1">Ожидает передачи со склада</span>
                                )}
                            </div>
                        </div>

                        {/* Step 2: Accepted */}
                        <div className="relative">
                            <div className={clsx(
                                "absolute -left-[21px] top-0 w-4 h-4 rounded-full border-2",
                                batch.materialsAcceptedDate ? "bg-emerald-500 border-emerald-500" : "bg-slate-900 border-slate-600"
                            )} />
                            <div className="flex flex-col">
                                <span className="text-sm font-medium text-slate-200">Приемка на производстве</span>
                                <span className="text-xs text-slate-500">{formatTime(batch.materialsAcceptedDate)}</span>
                                {batch.materialsHandoverDate && !batch.materialsAcceptedDate && (
                                    <span className="text-xs text-blue-400 mt-1">Материалы в пути / Ожидают приемки</span>
                                )}
                            </div>
                        </div>

                        {/* Step 3: Production Start */}
                        <div className="relative">
                            <div className={clsx(
                                "absolute -left-[21px] top-0 w-4 h-4 rounded-full border-2",
                                batch.status === 'in_progress' || batch.status === 'completed' ? "bg-emerald-500 border-emerald-500" : "bg-slate-900 border-slate-600"
                            )} />
                            <div className="flex flex-col">
                                <span className="text-sm font-medium text-slate-200">Запуск производства</span>
                                <span className="text-xs text-slate-500">{batch.startDate ? new Date(batch.startDate).toLocaleDateString() : '---'}</span>
                            </div>
                        </div>

                        {/* Step 4: Completion */}
                        <div className="relative">
                            <div className={clsx(
                                "absolute -left-[21px] top-0 w-4 h-4 rounded-full border-2",
                                batch.status === 'completed' ? "bg-emerald-500 border-emerald-500" : "bg-slate-900 border-slate-600"
                            )} />
                            <div className="flex flex-col">
                                <span className="text-sm font-medium text-slate-200">Завершение партии</span>
                                <span className="text-xs text-slate-500">{batch.endDate ? new Date(batch.endDate).toLocaleDateString() : 'В процессе'}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </Modal>
    );
}
