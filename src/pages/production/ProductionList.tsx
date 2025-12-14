import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Modal } from '../../components/ui/Modal';
import { MOCK_BATCHES, MOCK_RECIPES } from '../../data/mockProduction';
import { Play, CheckCircle, Clock, Plus, Calculator, History, Calendar } from 'lucide-react';
import { clsx } from 'clsx';
import type { ProductionBatch } from '../../types/production';
import BatchDetailsModal from './BatchDetailsModal';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function ProductionList() {
    const navigate = useNavigate();
    const { hasPermission } = useAuth();
    const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');

    // History Filters
    const [historyDateStart, setHistoryDateStart] = useState('');
    const [historyDateEnd, setHistoryDateEnd] = useState('');

    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [newBatchData, setNewBatchData] = useState<{
        recipeId: string;
        targetQuantity?: number;
        startDate: string;
    }>({
        recipeId: '',
        targetQuantity: undefined,
        startDate: ''
    });

    const [selectedBatch, setSelectedBatch] = useState<ProductionBatch | null>(null);
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

    const handleCreateBatch = (e: React.FormEvent) => {
        e.preventDefault();
        alert(`Партия запланирована!`);
        setIsCreateModalOpen(false);
        setNewBatchData({ recipeId: '', targetQuantity: undefined, startDate: '' });
    };

    const handleOpenDetails = (batch: ProductionBatch) => {
        setSelectedBatch(batch);
        setIsDetailsModalOpen(true);
    };

    // Filter Logic
    const displayedBatches = useMemo(() => {
        let filtered = MOCK_BATCHES;

        if (activeTab === 'active') {
            filtered = filtered.filter(b => b.status === 'in_progress' || b.status === 'planned');
        } else {
            filtered = filtered.filter(b => b.status === 'completed' || b.status === 'cancelled');
        }

        if (activeTab === 'history') {
            if (historyDateStart) {
                filtered = filtered.filter(b => b.startDate ? b.startDate >= historyDateStart : false);
            }
            if (historyDateEnd) {
                filtered = filtered.filter(b => b.startDate ? b.startDate <= historyDateEnd : false);
            }
        }

        return filtered;
    }, [activeTab, historyDateStart, historyDateEnd]);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-slate-100">Производство</h1>
                    <p className="text-slate-400 mt-1">Управление производственными партиями</p>
                </div>
                <div className="flex gap-3">

                    <Button variant="outline" onClick={() => navigate('/calculator')}>
                        <Calculator className="w-4 h-4 mr-2" />
                        Калькулятор
                    </Button>
                    {hasPermission('plan_production') && (
                        <Button onClick={() => setIsCreateModalOpen(true)}>
                            <Plus className="w-4 h-4 mr-2" />
                            Новая партия
                        </Button>
                    )}
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md://grid-cols-3 gap-6">
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-blue-400">
                            <Play className="w-5 h-5" />
                            В работе
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-slate-100">
                            {MOCK_BATCHES.filter(b => b.status === 'in_progress').length}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-slate-400">
                            <Clock className="w-5 h-5" />
                            Запланировано
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-slate-100">
                            {MOCK_BATCHES.filter(b => b.status === 'planned').length}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-emerald-400">
                            <CheckCircle className="w-5 h-5" />
                            Завершено (Всего)
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-slate-100">
                            {MOCK_BATCHES.filter(b => b.status === 'completed').length}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Tabs */}
            <div className="flex items-center justify-between border-b border-slate-700 pb-1">
                <div className="flex gap-4">
                    <button
                        className={clsx(
                            "px-4 py-2 text-sm font-medium transition-colors border-b-2 flex items-center gap-2",
                            activeTab === 'active' ? "border-blue-500 text-blue-400" : "border-transparent text-slate-400 hover:text-slate-200"
                        )}
                        onClick={() => setActiveTab('active')}
                    >
                        <Play size={16} />
                        Активные партии
                    </button>
                    <button
                        className={clsx(
                            "px-4 py-2 text-sm font-medium transition-colors border-b-2 flex items-center gap-2",
                            activeTab === 'history' ? "border-emerald-500 text-emerald-400" : "border-transparent text-slate-400 hover:text-slate-200"
                        )}
                        onClick={() => setActiveTab('history')}
                    >
                        <History size={16} />
                        История производства
                    </button>
                </div>

                {activeTab === 'history' && (
                    <div className="flex gap-2 items-center">
                        <Calendar size={16} className="text-slate-500" />
                        <Input
                            type="date"
                            className="w-36 h-8 text-xs bg-slate-800"
                            value={historyDateStart}
                            onChange={(e) => setHistoryDateStart(e.target.value)}
                        />
                        <span className="text-slate-500">-</span>
                        <Input
                            type="date"
                            className="w-36 h-8 text-xs bg-slate-800"
                            value={historyDateEnd}
                            onChange={(e) => setHistoryDateEnd(e.target.value)}
                        />
                        {(historyDateStart || historyDateEnd) && (
                            <Button variant="ghost" size="sm" onClick={() => { setHistoryDateStart(''); setHistoryDateEnd(''); }}>
                                Сброс
                            </Button>
                        )}
                    </div>
                )}
            </div>

            <Card>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-slate-900 border-b border-slate-800">
                                <tr>
                                    {/* ID Column Removed */}
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Рецепт</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Статус</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Дата начала</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Выпуск (КГ)</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">Действия</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                                {displayedBatches.length > 0 ? displayedBatches.map(batch => {
                                    const recipe = MOCK_RECIPES.find(r => r.id === batch.recipeId);

                                    // Calculate KG output. Assuming targetQuantity is 'batches'.
                                    // Recipe outputQuantity is usually "units per batch" or "kg per batch".
                                    // We'll trust the recipe's output units. If recipe output is packs, we might need weight.
                                    // simpler: Just display "X kg" if we assume outputQuantity is normalized.
                                    // Or user said "In KG, not pieces". Let's assume calculated total.
                                    // For now: batch.targetQuantity (batches) * recipe.outputQuantity (per batch)
                                    // And append "kg" as requested.

                                    const totalOutput = batch.targetQuantity * (recipe?.outputQuantity || 0);

                                    return (
                                        <tr key={batch.id} className="hover:bg-slate-800/50 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap text-slate-200 font-medium">{recipe?.name || 'Unknown'}</td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={clsx(
                                                    'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                                                    batch.status === 'completed' ? 'bg-emerald-900/30 text-emerald-400' :
                                                        batch.status === 'in_progress' ? 'bg-blue-900/30 text-blue-400' :
                                                            'bg-slate-700 text-slate-300'
                                                )}>
                                                    {batch.status === 'completed' ? 'Завершен' :
                                                        batch.status === 'in_progress' ? 'В работе' : 'Планируется'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-slate-400">
                                                {batch.startDate ? new Date(batch.startDate).toLocaleDateString() : '---'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-slate-200">
                                                {totalOutput.toLocaleString()} <span className="text-slate-500 text-xs">кг</span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right">
                                                <Button variant="ghost" size="sm" onClick={() => handleOpenDetails(batch as ProductionBatch)}>
                                                    Детали
                                                </Button>
                                            </td>
                                        </tr>
                                    );
                                }) : (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-8 text-center text-slate-500 italic">
                                            Нет партий для отображения
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>

            <Modal
                isOpen={isCreateModalOpen} // Updated modal state
                onClose={() => setIsCreateModalOpen(false)} // Updated modal state
                title="Новый Производственный Заказ" // Updated title
            >
                <form onSubmit={handleCreateBatch} className="space-y-4">
                    <Select
                        label="Технологическая карта (Рецепт)" // Updated label
                        options={[
                            { value: '', label: 'Выберите продукт...' }, // Updated label
                            ...MOCK_RECIPES.map(r => ({ value: r.id, label: r.name }))
                        ]}
                        value={newBatchData.recipeId} // Updated state variable
                        onChange={e => setNewBatchData({ ...newBatchData, recipeId: e.target.value })} // Updated state variable
                        required
                    />
                    <div>
                        <Input
                            label="Планируемый объем (КГ)" // Updated label
                            type="number"
                            min="1"
                            value={newBatchData.targetQuantity || ''} // Updated state variable, allowing empty string for undefined
                            onChange={e => setNewBatchData({ ...newBatchData, targetQuantity: parseInt(e.target.value) || undefined })} // Updated state variable, using undefined
                            required
                            placeholder="Например: 500" // Added placeholder
                        />
                        {newBatchData.targetQuantity !== undefined && newBatchData.targetQuantity > 0 && ( // Added condition for display
                            <p className="text-xs text-slate-500 mt-1">
                                = {(newBatchData.targetQuantity * 10).toLocaleString()} пачек (по 100г)
                            </p>
                        )}
                    </div>

                    <Input
                        label="Плановая дата начала" // Updated label
                        type="date"
                        value={newBatchData.startDate} // Updated state variable
                        onChange={e => setNewBatchData({ ...newBatchData, startDate: e.target.value })} // Updated state variable
                        required
                    />
                    <div className="flex justify-end gap-3 pt-4">
                        <Button type="button" variant="ghost" onClick={() => setIsCreateModalOpen(false)}>
                            Отмена
                        </Button>
                        <Button type="submit">
                            Создать заказ
                        </Button>
                    </div>
                </form>
            </Modal>

            {selectedBatch && (
                <BatchDetailsModal
                    batch={selectedBatch}
                    isOpen={isDetailsModalOpen}
                    onClose={() => setIsDetailsModalOpen(false)}
                />
            )}
        </div>
    );
}
