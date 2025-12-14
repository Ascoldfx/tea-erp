import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';

import { MOCK_BATCHES, MOCK_RECIPES } from '../../data/mockProduction';
import { MOCK_JOBS, MOCK_CONTRACTORS } from '../../data/mockContractors';
import { Factory, Clock, Banknote, Scale } from 'lucide-react';
import { clsx } from 'clsx';
import { useNavigate } from 'react-router-dom';
import { useMemo } from 'react';

export default function Dashboard() {
    const navigate = useNavigate();

    const activeBatches = MOCK_BATCHES.filter(b => b.status === 'in_progress').length;
    const activeJobs = MOCK_JOBS.filter(j => j.status === 'in_progress').length;

    // Financials: Total Debt
    const totalDebt = MOCK_CONTRACTORS.reduce((acc, c) => acc + (c.balance || 0), 0);

    // Production: KG produced this month (Mock: just sum all completed batches * recipe output)
    const producedKg = useMemo(() => {
        return MOCK_BATCHES
            .filter(b => b.status === 'completed')
            .reduce((acc, batch) => {
                const recipe = MOCK_RECIPES.find(r => r.id === batch.recipeId);
                return acc + (batch.targetQuantity * (recipe?.outputQuantity || 0));
            }, 0);
    }, []);

    const productionPlan = [
        { name: 'Batik Royal', target: 5000, current: 2300, unit: 'kg' },
        { name: 'Earl Grey Special', target: 2000, current: 850, unit: 'kg' },
        { name: 'Green Jasmine', target: 1500, current: 1500, unit: 'kg' },
        { name: 'Assam Gold', target: 3000, current: 1200, unit: 'kg' }
    ];

    const stats = [
        {
            label: 'Партий в работе',
            value: activeBatches,
            icon: Factory,
            color: 'text-blue-600',
            bgColor: 'bg-blue-100',
            action: () => navigate('/production')
        },
        {
            label: 'Задолженность',
            value: `${totalDebt.toLocaleString()} ₴`,
            icon: Banknote,
            color: 'text-amber-600',
            bgColor: 'bg-amber-100',
            action: () => navigate('/contractors')
        },
        {
            label: 'Произведено (Мес)',
            value: `${producedKg.toLocaleString()} кг`,
            icon: Scale,
            color: 'text-emerald-600',
            bgColor: 'bg-emerald-100',
            action: () => navigate('/production')
        }
    ];

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-slate-100">Обзор</h1>
                <p className="text-slate-400 mt-1">Краткая сводка показателей вашего чайного производства.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {stats.map((stat, index) => (
                    <Card
                        key={index}
                        className="cursor-pointer hover:shadow-lg transition-all hover:scale-[1.02] border-slate-800 bg-slate-900"
                        onClick={stat.action}
                    >
                        <CardContent className="p-6 flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-slate-400">{stat.label}</p>
                                <p className="text-2xl font-bold text-slate-100 mt-1">{stat.value}</p>
                            </div>
                            <div className={clsx('p-3 rounded-xl bg-slate-800', stat.color)}>
                                <stat.icon className={clsx('w-6 h-6')} />
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Production Plan Widget */}
            <Card className="border-emerald-500/20 bg-slate-900/50">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Clock className="w-5 h-5 text-emerald-500" />
                        План производства (Ноябрь)
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {productionPlan.map((item, i) => {
                            const progress = Math.min(100, Math.round((item.current / item.target) * 100));
                            return (
                                <div key={i} className="space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="font-medium text-slate-200">{item.name}</span>
                                        <span className="text-slate-400">{progress}%</span>
                                    </div>
                                    <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-emerald-500 transition-all duration-500"
                                            style={{ width: `${progress}%` }}
                                        />
                                    </div>
                                    <div className="flex justify-between text-xs text-slate-500">
                                        <span>{item.current} {item.unit}</span>
                                        <span>Цель: {item.target} {item.unit}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <Card>
                    <CardHeader>
                        <CardTitle>Финансовая сводка</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center p-3 bg-slate-800/50 rounded-lg">
                                <span className="text-slate-400">Долг перед поставщиками</span>
                                <span className="text-red-400 font-bold">{totalDebt.toLocaleString()} ₴</span>
                            </div>
                            <div className="flex justify-between items-center p-3 bg-slate-800/50 rounded-lg">
                                <span className="text-slate-400">Заказов в работе у подрядчиков</span>
                                <span className="text-blue-400 font-bold">{activeJobs}</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Производство</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center p-3 bg-slate-800/50 rounded-lg">
                                <span className="text-slate-400">Общий выпуск (КГ)</span>
                                <span className="text-emerald-400 font-bold">{producedKg.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center p-3 bg-slate-800/50 rounded-lg">
                                <span className="text-slate-400">Активных партий</span>
                                <span className="text-blue-400 font-bold">{activeBatches}</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
