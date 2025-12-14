import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Modal } from '../../components/ui/Modal';
import { Truck, Plus, AlertTriangle, CheckCircle, Package, Trash } from 'lucide-react';
import { MOCK_CONTRACTORS, MOCK_JOBS } from '../../data/mockContractors';
import { MOCK_RECIPES } from '../../data/mockProduction';
import { MOCK_STOCK, MOCK_ITEMS } from '../../data/mockInventory';
import { clsx } from 'clsx';
import type { JobStatus } from '../../types/contractors';

export function ContractorsList() {
    const [activeTab, setActiveTab] = useState<'contractors' | 'jobs'>('contractors');
    // State for tabs

    // New Job Modal State
    const [isJobModalOpen, setIsJobModalOpen] = useState(false);
    const [newJob, setNewJob] = useState<{
        contractorId: string;
        items: { recipeId: string; quantityKg: number }[];
        date: string;
    }>({
        contractorId: '',
        items: [{ recipeId: '', quantityKg: 0 }],
        date: ''
    });

    // Material Analysis for New Job (Aggregate across all items)
    const materialAnalysis = useMemo(() => {
        if (!newJob.contractorId || newJob.items.length === 0) return null;

        const allIngredients: Record<string, number> = {};

        newJob.items.forEach(jobItem => {
            if (!jobItem.recipeId || jobItem.quantityKg <= 0) return;
            const recipe = MOCK_RECIPES.find(r => r.id === jobItem.recipeId);
            if (!recipe) return;

            // Mock conversion: 1 Batch = 100kg (example for MVP simplicity)
            // Real app would use recipe.outputQuantity (e.g. 1000 units) and unit weight.
            // Let's assume recipe units are defined for "1 Standard Batch".
            // We need to scale ingredients.
            // For this MVP, let's treat quantityKg directly proportional to batch size 
            // assuming standard batch = 100kg.
            const batches = jobItem.quantityKg / 100;

            recipe.ingredients.forEach(ing => {
                allIngredients[ing.itemId] = (allIngredients[ing.itemId] || 0) + (ing.quantity * batches);
            });
        });

        if (Object.keys(allIngredients).length === 0) return null;

        const contractorWhId = 'wh-contractor-main'; // Mock ID

        return Object.entries(allIngredients).map(([itemId, requiredAmount]) => {
            const item = MOCK_ITEMS.find(i => i.id === itemId);

            const stockAtContractor = MOCK_STOCK
                .filter(s => s.itemId === itemId && s.warehouseId === contractorWhId)
                .reduce((acc, curr) => acc + curr.quantity, 0);

            const missing = Math.max(0, requiredAmount - stockAtContractor);

            return {
                itemId,
                name: item?.name || itemId,
                unit: item?.unit,
                required: requiredAmount,
                available: stockAtContractor,
                missing,
                status: missing <= 0 ? 'ok' : 'shortage'
            };
        });
    }, [newJob]);


    const handleCreateJob = (e: React.FormEvent) => {
        e.preventDefault();
        alert('Задача создана! Логистика уведомлена о недостающих материалах.');
        setIsJobModalOpen(false);
    };

    const handleAddContractor = () => {
        alert('Функция добавления подрядчика (в разработке)');
    };

    const getStatusColor = (status: JobStatus) => {
        switch (status) {
            case 'planned': return 'bg-slate-700 text-slate-300';
            case 'in_progress': return 'bg-blue-900/40 text-blue-400';
            case 'completed': return 'bg-emerald-900/40 text-emerald-400';
            case 'cancelled': return 'bg-red-900/40 text-red-400';
            default: return 'bg-slate-700 text-slate-300';
        }
    };

    const getStatusLabel = (status: JobStatus) => {
        switch (status) {
            case 'planned': return 'Запланировано';
            case 'in_progress': return 'В работе';
            case 'completed': return 'Выполнено';
            case 'cancelled': return 'Отменено';
            default: return status;
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-slate-100">Подрядчики</h1>
                    <p className="text-slate-400 mt-1">Управление внешними производствами и заказами</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={handleAddContractor}>
                        <Plus className="w-4 h-4 mr-2" />
                        Добавить подрядчика
                    </Button>
                    <Button onClick={() => setIsJobModalOpen(true)}>
                        <Plus className="w-4 h-4 mr-2" />
                        Создать задачу
                    </Button>
                </div>
            </div>

            <div className="flex gap-4 border-b border-slate-800">
                <button
                    className={clsx(
                        'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
                        activeTab === 'contractors'
                            ? 'border-emerald-500 text-emerald-400'
                            : 'border-transparent text-slate-400 hover:text-slate-200'
                    )}
                    onClick={() => setActiveTab('contractors')}
                >
                    Подрядчики
                </button>
                <button
                    className={clsx(
                        'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
                        activeTab === 'jobs'
                            ? 'border-emerald-500 text-emerald-400'
                            : 'border-transparent text-slate-400 hover:text-slate-200'
                    )}
                    onClick={() => setActiveTab('jobs')}
                >
                    Задачи и Работы
                </button>
            </div>

            {/* Content Tabs */}
            {activeTab === 'contractors' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {MOCK_CONTRACTORS.map(contractor => (
                        <Card key={contractor.id} className="hover:border-emerald-500/50 transition-colors cursor-pointer">
                            <CardContent className="pt-6">
                                <div className="flex items-start justify-between mb-4">
                                    <div className="p-2 bg-slate-800 rounded-lg">
                                        <Truck className="w-6 h-6 text-emerald-500" />
                                    </div>
                                    <span className="text-xs font-medium text-slate-500 bg-slate-800 px-2 py-1 rounded">
                                        Активен
                                    </span>
                                </div>
                                <h3 className="text-lg font-bold text-slate-100 mb-1">{contractor.name}</h3>
                                <p className="text-sm text-slate-400 mb-4">{contractor.contactPerson}</p>
                                <div className="space-y-2 text-sm text-slate-500">
                                    <div className="flex items-center gap-2">
                                        <span>📞</span> {contractor.phone}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span>📧</span> {contractor.email}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span>📍</span> {contractor.address}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {activeTab === 'jobs' && (
                <Card>
                    <CardHeader>
                        <CardTitle>Список задач</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-slate-900 border-b border-slate-800">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">ID</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Подрядчик</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Описание</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Дата</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Стоимость</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Статус</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800">
                                    {MOCK_JOBS.map(job => (
                                        <tr key={job.id} className="hover:bg-slate-800/50 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap font-medium text-slate-200">{job.id}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-slate-400">
                                                {MOCK_CONTRACTORS.find(c => c.id === job.contractorId)?.name}
                                            </td>
                                            <td className="px-6 py-4 text-slate-400">{job.description}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-slate-500">{new Date(job.date).toLocaleDateString()}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-slate-200 font-medium">
                                                {job.totalAmount.toLocaleString()} ₴
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={clsx('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium', getStatusColor(job.status))}>
                                                    {getStatusLabel(job.status)}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Create Job Modal */}
            <Modal
                isOpen={isJobModalOpen}
                onClose={() => setIsJobModalOpen(false)}
                title="Новая задача для подрядчика"
            >
                <form onSubmit={handleCreateJob} className="space-y-6">
                    <div className="space-y-4">
                        <Select
                            label="Подрядчик"
                            options={[
                                { value: '', label: 'Выберите подрядчика...' },
                                ...MOCK_CONTRACTORS.map(c => ({ value: c.id, label: c.name }))
                            ]}
                            value={newJob.contractorId}
                            onChange={e => setNewJob({ ...newJob, contractorId: e.target.value })}
                            required
                        />
                        {/* Multi-Item Inputs */}
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <h4 className="text-sm font-medium text-slate-300">Список продукции</h4>
                                <Button type="button" variant="ghost" size="sm" onClick={() => {
                                    setNewJob({ ...newJob, items: [...newJob.items, { recipeId: '', quantityKg: 0 }] });
                                }}>
                                    <Plus className="w-4 h-4 mr-1" /> Добавить
                                </Button>
                            </div>

                            {newJob.items.map((item, index) => (
                                <div key={index} className="flex gap-4 items-end bg-slate-800/50 p-3 rounded-lg border border-slate-700">
                                    <div className="flex-1">
                                        <Select
                                            label={index === 0 ? "Продукция (Рецепт)" : undefined}
                                            options={[
                                                { value: '', label: 'Выберите...' },
                                                ...MOCK_RECIPES.map(r => ({ value: r.id, label: r.name }))
                                            ]}
                                            value={item.recipeId}
                                            onChange={e => {
                                                const updatedItems = [...newJob.items];
                                                updatedItems[index].recipeId = e.target.value;
                                                setNewJob({ ...newJob, items: updatedItems });
                                            }}
                                            required
                                        />
                                    </div>
                                    <div className="w-32">
                                        <Input
                                            label={index === 0 ? "Вес (КГ)" : undefined}
                                            type="number"
                                            min="0"
                                            value={item.quantityKg || ''}
                                            onChange={e => {
                                                const updatedItems = [...newJob.items];
                                                updatedItems[index].quantityKg = parseInt(e.target.value) || 0;
                                                setNewJob({ ...newJob, items: updatedItems });
                                            }}
                                            required
                                        />
                                    </div>
                                    {newJob.items.length > 1 && (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            className="mb-0.5 text-red-400 hover:text-red-300 hover:bg-red-900/20"
                                            onClick={() => {
                                                const updatedItems = newJob.items.filter((_, i) => i !== index);
                                                setNewJob({ ...newJob, items: updatedItems });
                                            }}
                                        >
                                            <Trash className="w-4 h-4" />
                                        </Button>
                                    )}
                                </div>
                            ))}
                        </div>

                        <Input
                            label="Дата сдачи"
                            type="date"
                            value={newJob.date}
                            onChange={e => setNewJob({ ...newJob, date: e.target.value })}
                            required
                        />
                    </div>

                    {/* Material Check */}
                    {materialAnalysis && (
                        <div className="bg-slate-900 rounded p-4 border border-slate-800">
                            <h4 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
                                <Package className="w-4 h-4 text-slate-500" />
                                Наличие материалов у подрядчика
                            </h4>
                            <div className="space-y-3">
                                {materialAnalysis.map(item => (
                                    <div key={item.itemId} className="flex justify-between items-center text-sm">
                                        <div className="flex-1">
                                            <div className="text-slate-200">{item.name}</div>
                                            <div className="text-xs text-slate-500">
                                                Нужно: {item.required} {item.unit} | Есть: {item.available} {item.unit}
                                            </div>
                                        </div>
                                        <div>
                                            {item.status === 'ok' ? (
                                                <span className="flex items-center text-emerald-500 text-xs font-medium">
                                                    <CheckCircle className="w-3 h-3 mr-1" />
                                                    ОК
                                                </span>
                                            ) : (
                                                <span className="flex items-center text-red-400 text-xs font-bold">
                                                    <AlertTriangle className="w-3 h-3 mr-1" />
                                                    Не хватает {item.missing} {item.unit}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="mt-3 pt-3 border-t border-slate-800 text-xs text-slate-500 text-center">
                                * Если материалов не хватает, необходимо оформить перемещение.
                            </div>
                        </div>
                    )}

                    <div className="flex justify-end gap-3 pt-2">
                        <Button type="button" variant="ghost" onClick={() => setIsJobModalOpen(false)}>
                            Отмена
                        </Button>
                        <Button type="submit">
                            Создать задачу
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
