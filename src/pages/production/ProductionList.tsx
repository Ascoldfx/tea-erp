import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Modal } from '../../components/ui/Modal';
import { MOCK_BATCHES, MOCK_RECIPES } from '../../data/mockProduction';
import { CheckCircle, Clock, Plus, Calculator, Calendar } from 'lucide-react';
import { clsx } from 'clsx';
import type { ProductionBatch } from '../../types/production';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';

export default function ProductionList() {
    const navigate = useNavigate();
    const { hasPermission } = useAuth();
    const { t, language } = useLanguage();
    const [activeTab, setActiveTab] = useState<'planning' | 'actual'>('planning');

    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [newBatchData, setNewBatchData] = useState<{
        recipeId: string;
        targetQuantity?: number;
        weekNumber: number;
    }>({
        recipeId: '',
        targetQuantity: undefined,
        weekNumber: 1
    });


    // Get current month and weeks
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();
    
    // Get week number (ISO week)
    function getWeekNumber(date: Date): number {
        const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        const dayNum = d.getUTCDay() || 7;
        d.setUTCDate(d.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    }

    // Get weeks for current month
    const weeks = useMemo(() => {
        const monthStart = new Date(currentYear, currentMonth, 1);
        const monthEnd = new Date(currentYear, currentMonth + 1, 0);
        
        const weeksList: Array<{ weekNumber: number; startDate: Date; endDate: Date }> = [];
        
        // Find first Monday of the month
        const firstDay = new Date(monthStart);
        const firstDayOfWeek = firstDay.getDay();
        const daysToMonday = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
        const weekStart = new Date(firstDay);
        weekStart.setDate(firstDay.getDate() - daysToMonday);

        let currentWeekStart = new Date(weekStart);
        let weekNumber = getWeekNumber(currentWeekStart);

        while (currentWeekStart <= monthEnd) {
            const weekEnd = new Date(currentWeekStart);
            weekEnd.setDate(currentWeekStart.getDate() + 6);

            weeksList.push({
                weekNumber,
                startDate: new Date(currentWeekStart),
                endDate: weekEnd
            });

            currentWeekStart.setDate(currentWeekStart.getDate() + 7);
            weekNumber = getWeekNumber(currentWeekStart);
        }

        return weeksList;
    }, [currentMonth, currentYear]);

    // Group batches by week
    const batchesByWeek = useMemo(() => {
        const grouped: Record<number, { planned: ProductionBatch[]; actual: ProductionBatch[] }> = {};
        
        weeks.forEach(week => {
            grouped[week.weekNumber] = { planned: [], actual: [] };
        });

        MOCK_BATCHES.forEach(batch => {
            if (!batch.startDate) return;
            const batchDate = new Date(batch.startDate);
            const weekNum = getWeekNumber(batchDate);
            
            if (grouped[weekNum]) {
                if (batch.status === 'completed' && batch.producedQuantity) {
                    grouped[weekNum].actual.push(batch);
                } else if (batch.status === 'planned' || batch.status === 'in_progress') {
                    grouped[weekNum].planned.push(batch);
                }
            }
        });

        return grouped;
    }, [weeks]);

    const handleCreateBatch = (e: React.FormEvent) => {
        e.preventDefault();
        alert(`Партия запланирована на неделю ${newBatchData.weekNumber}!`);
        setIsCreateModalOpen(false);
        setNewBatchData({ recipeId: '', targetQuantity: undefined, weekNumber: 1 });
    };


    const monthName = currentDate.toLocaleDateString(language === 'uk' ? 'uk-UA' : 'ru-RU', { month: 'long', year: 'numeric' });

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-slate-100">
                        {t('production.title') || 'Производство'}
                    </h1>
                    <p className="text-slate-400 mt-1">
                        {t('production.subtitle') || 'Планирование и учет производства'}
                    </p>
                </div>
                <div className="flex gap-3">
                    <Button variant="outline" onClick={() => navigate('/calculator')}>
                        <Calculator className="w-4 h-4 mr-2" />
                        {t('production.calculator') || 'Калькулятор'}
                    </Button>
                    {hasPermission('plan_production') && (
                        <Button onClick={() => setIsCreateModalOpen(true)}>
                            <Plus className="w-4 h-4 mr-2" />
                            {t('production.newBatch') || 'Новая партия'}
                        </Button>
                    )}
                </div>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-4 border-b border-slate-700 pb-1">
                <button
                    className={clsx(
                        "px-4 py-2 text-sm font-medium transition-colors border-b-2 flex items-center gap-2",
                        activeTab === 'planning' ? "border-blue-500 text-blue-400" : "border-transparent text-slate-400 hover:text-slate-200"
                    )}
                    onClick={() => setActiveTab('planning')}
                >
                    <Clock size={16} />
                    {t('production.planning') || 'Планирование'}
                </button>
                <button
                    className={clsx(
                        "px-4 py-2 text-sm font-medium transition-colors border-b-2 flex items-center gap-2",
                        activeTab === 'actual' ? "border-emerald-500 text-emerald-400" : "border-transparent text-slate-400 hover:text-slate-200"
                    )}
                    onClick={() => setActiveTab('actual')}
                >
                    <CheckCircle size={16} />
                    {t('production.actual') || 'Фактическое производство'}
                </button>
            </div>

            {/* Planning View - Weekly Breakdown */}
            {activeTab === 'planning' && (
                <div className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Calendar className="w-5 h-5" />
                                {monthName}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-6">
                                {weeks.map((week, weekIndex) => {
                                    const weekBatches = batchesByWeek[week.weekNumber] || { planned: [], actual: [] };
                                    const plannedBatches = weekBatches.planned;
                                    
                                    return (
                                        <div key={weekIndex} className="border border-slate-700 rounded-lg p-4 bg-slate-800/30">
                                            <div className="flex items-center gap-3 mb-4">
                                                <div className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-lg font-semibold text-sm">
                                                    {t('production.week') || 'Неделя'} {week.weekNumber}
                                                </div>
                                                <span className="text-sm text-slate-400">
                                                    {week.startDate.toLocaleDateString(language === 'uk' ? 'uk-UA' : 'ru-RU', { 
                                                        day: 'numeric', 
                                                        month: 'short' 
                                                    })} - {week.endDate.toLocaleDateString(language === 'uk' ? 'uk-UA' : 'ru-RU', { 
                                                        day: 'numeric', 
                                                        month: 'short',
                                                        year: week.endDate.getMonth() !== week.startDate.getMonth() ? 'numeric' : undefined
                                                    })}
                                                </span>
                                            </div>
                                            
                                            {plannedBatches.length > 0 ? (
                                                <div className="space-y-2">
                                                    {plannedBatches.map(batch => {
                                                        const recipe = MOCK_RECIPES.find(r => r.id === batch.recipeId);
                                                        const totalOutput = batch.targetQuantity * (recipe?.outputQuantity || 0) / 1000; // Convert to kg
                                                        
                                                        return (
                                                            <div key={batch.id} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                                                                <div>
                                                                    <p className="text-slate-200 font-medium">{recipe?.name || 'Unknown'}</p>
                                                                    <p className="text-xs text-slate-400">
                                                                        {t('production.planned') || 'Запланировано'}: {totalOutput.toLocaleString()} кг
                                                                    </p>
                                                                </div>
                                                                <span className={clsx(
                                                                    "px-2.5 py-0.5 rounded-full text-xs font-medium",
                                                                    batch.status === 'in_progress' ? 'bg-blue-900/30 text-blue-400' : 'bg-slate-700 text-slate-300'
                                                                )}>
                                                                    {batch.status === 'in_progress' ? (t('production.inProgress') || 'В работе') : (t('production.planned') || 'Запланировано')}
                                                                </span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            ) : (
                                                <p className="text-slate-500 text-sm italic">
                                                    {t('production.noPlanned') || 'Нет запланированных партий'}
                                                </p>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Actual Production View */}
            {activeTab === 'actual' && (
                <Card>
                    <CardHeader>
                        <CardTitle>
                            {t('production.actualProduction') || 'Фактическое производство'}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {weeks.map((week, weekIndex) => {
                                const weekBatches = batchesByWeek[week.weekNumber] || { planned: [], actual: [] };
                                const actualBatches = weekBatches.actual;
                                
                                if (actualBatches.length === 0) return null;
                                
                                return (
                                    <div key={weekIndex} className="border border-slate-700 rounded-lg p-4 bg-slate-800/30">
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-lg font-semibold text-sm">
                                                {t('production.week') || 'Неделя'} {week.weekNumber}
                                            </div>
                                            <span className="text-sm text-slate-400">
                                                {week.startDate.toLocaleDateString(language === 'uk' ? 'uk-UA' : 'ru-RU', { 
                                                    day: 'numeric', 
                                                    month: 'short' 
                                                })} - {week.endDate.toLocaleDateString(language === 'uk' ? 'uk-UA' : 'ru-RU', { 
                                                    day: 'numeric', 
                                                    month: 'short'
                                                })}
                                            </span>
                                        </div>
                                        
                                        <div className="space-y-2">
                                            {actualBatches.map(batch => {
                                                const recipe = MOCK_RECIPES.find(r => r.id === batch.recipeId);
                                                const plannedOutput = batch.targetQuantity * (recipe?.outputQuantity || 0) / 1000; // Convert to kg
                                                const actualOutput = (batch.producedQuantity || 0) * (recipe?.outputQuantity || 0) / 1000; // Convert to kg
                                                
                                                return (
                                                    <div key={batch.id} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                                                        <div>
                                                            <p className="text-slate-200 font-medium">{recipe?.name || 'Unknown'}</p>
                                                            <div className="flex items-center gap-4 mt-1">
                                                                <p className="text-xs text-slate-400">
                                                                    {t('production.planned') || 'Запланировано'}: <span className="text-slate-300">{plannedOutput.toLocaleString()} кг</span>
                                                                </p>
                                                                <p className="text-xs text-emerald-400">
                                                                    {t('production.produced') || 'Произведено'}: <span className="font-semibold">{actualOutput.toLocaleString()} кг</span>
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-900/30 text-emerald-400">
                                                            {t('production.completed') || 'Завершено'}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                            
                            {Object.values(batchesByWeek).every(w => w.actual.length === 0) && (
                                <p className="text-slate-500 text-sm italic text-center py-8">
                                    {t('production.noActual') || 'Нет данных о фактическом производстве'}
                                </p>
                            )}
                        </div>
                    </CardContent>
                </Card>
            )}

            <Modal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                title={t('production.newBatch') || 'Новая партия'}
            >
                <form onSubmit={handleCreateBatch} className="space-y-4">
                    <Select
                        label={t('production.recipe') || 'Технологическая карта (Рецепт)'}
                        options={[
                            { value: '', label: t('production.selectRecipe') || 'Выберите продукт...' },
                            ...MOCK_RECIPES.map(r => ({ value: r.id, label: r.name }))
                        ]}
                        value={newBatchData.recipeId}
                        onChange={e => setNewBatchData({ ...newBatchData, recipeId: e.target.value })}
                        required
                    />
                    <div>
                        <Input
                            label={t('production.plannedQuantity') || 'Планируемый объем (КГ)'}
                            type="number"
                            min="1"
                            value={newBatchData.targetQuantity || ''}
                            onChange={e => setNewBatchData({ ...newBatchData, targetQuantity: parseInt(e.target.value) || undefined })}
                            required
                            placeholder="Например: 500"
                        />
                    </div>
                    <Select
                        label={t('production.week') || 'Неделя'}
                        options={weeks.map(w => ({
                            value: w.weekNumber.toString(),
                            label: `${t('production.week') || 'Неделя'} ${w.weekNumber} (${w.startDate.toLocaleDateString(language === 'uk' ? 'uk-UA' : 'ru-RU', { day: 'numeric', month: 'short' })} - ${w.endDate.toLocaleDateString(language === 'uk' ? 'uk-UA' : 'ru-RU', { day: 'numeric', month: 'short' })})`
                        }))}
                        value={newBatchData.weekNumber.toString()}
                        onChange={e => setNewBatchData({ ...newBatchData, weekNumber: parseInt(e.target.value) })}
                        required
                    />
                    <div className="flex justify-end gap-3 pt-4">
                        <Button type="button" variant="ghost" onClick={() => setIsCreateModalOpen(false)}>
                            {t('common.cancel') || 'Отмена'}
                        </Button>
                        <Button type="submit">
                            {t('production.create') || 'Создать заказ'}
                        </Button>
                    </div>
                </form>
            </Modal>

        </div>
    );
}
