import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { Input } from '../../components/ui/Input';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { clsx } from 'clsx';
import { MOCK_RECIPES } from '../../data/mockProduction';
import { useInventory } from '../../hooks/useInventory';

interface DayProduction {
    date: string;
    recipeId: string;
    quantity: number;
    location: 'internal' | 'contractor';
    contractorId?: string;
}

export default function LogisticsCalendar() {
    const { t, language } = useLanguage();
    const { items, warehouses, stock } = useInventory();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDay, setSelectedDay] = useState<Date | null>(null);
    const [isDayModalOpen, setIsDayModalOpen] = useState(false);
    const [dayProductions, setDayProductions] = useState<DayProduction[]>([]);
    const [newProduction, setNewProduction] = useState<{
        recipeId: string;
        quantity: number;
        location: 'internal' | 'contractor';
        contractorId: string;
    }>({
        recipeId: '',
        quantity: 0,
        location: 'internal',
        contractorId: ''
    });

    // Get start of current month
    const monthStart = useMemo(() => {
        const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        return date;
    }, [currentDate]);

    // Get end of current month
    const monthEnd = useMemo(() => {
        const date = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
        return date;
    }, [currentDate]);

    // Get week number (ISO week)
    function getWeekNumber(date: Date): number {
        const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        const dayNum = d.getUTCDay() || 7;
        d.setUTCDate(d.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    }

    // Get all weeks in the month
    const weeks = useMemo(() => {
        const weeksList: Array<{ weekNumber: number; startDate: Date; endDate: Date; days: Date[] }> = [];
        
        // Find first Monday of the month (or start of month if it's Monday)
        const firstDay = new Date(monthStart);
        const firstDayOfWeek = firstDay.getDay(); // 0 = Sunday, 1 = Monday, etc.
        const daysToMonday = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
        const weekStart = new Date(firstDay);
        weekStart.setDate(firstDay.getDate() - daysToMonday);

        let currentWeekStart = new Date(weekStart);
        let weekNumber = getWeekNumber(currentWeekStart);

        while (currentWeekStart <= monthEnd) {
            const weekEnd = new Date(currentWeekStart);
            weekEnd.setDate(currentWeekStart.getDate() + 6);

            const days: Date[] = [];
            for (let i = 0; i < 7; i++) {
                const day = new Date(currentWeekStart);
                day.setDate(currentWeekStart.getDate() + i);
                days.push(day);
            }

            weeksList.push({
                weekNumber,
                startDate: new Date(currentWeekStart),
                endDate: weekEnd,
                days
            });

            currentWeekStart.setDate(currentWeekStart.getDate() + 7);
            weekNumber = getWeekNumber(currentWeekStart);
        }

        return weeksList;
    }, [monthStart, monthEnd]);

    const monthName = monthStart.toLocaleDateString(language === 'uk' ? 'uk-UA' : 'ru-RU', { month: 'long', year: 'numeric' });
    const dayNames = language === 'uk' 
        ? ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд']
        : ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

    const navigateMonth = (direction: 'prev' | 'next') => {
        const newDate = new Date(currentDate);
        newDate.setMonth(currentDate.getMonth() + (direction === 'next' ? 1 : -1));
        setCurrentDate(newDate);
    };

    const isToday = (date: Date) => {
        const today = new Date();
        return date.toDateString() === today.toDateString();
    };

    const isCurrentMonth = (date: Date) => {
        return date.getMonth() === currentDate.getMonth();
    };

    const handleDayClick = (date: Date) => {
        setSelectedDay(date);
        setIsDayModalOpen(true);
        // Reset form
        setNewProduction({
            recipeId: '',
            quantity: 0,
            location: 'internal',
            contractorId: ''
        });
    };

    const handleAddProduction = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedDay || !newProduction.recipeId || newProduction.quantity <= 0) return;
        
        // Validate contractor selection if location is contractor
        if (newProduction.location === 'contractor' && !newProduction.contractorId) {
            alert(t('calendar.selectContractor') || 'Выберите подрядчика');
            return;
        }
        
        const dateStr = selectedDay.toISOString().split('T')[0];
        const production: DayProduction = {
            date: dateStr,
            recipeId: newProduction.recipeId,
            quantity: newProduction.quantity,
            location: newProduction.location,
            contractorId: newProduction.location === 'contractor' ? newProduction.contractorId : undefined
        };
        
        setDayProductions([...dayProductions, production]);
        setNewProduction({
            recipeId: '',
            quantity: 0,
            location: 'internal',
            contractorId: ''
        });
        
        // Don't close modal automatically - let user decide if they want to add more or close
    };
    
    const handleCloseModal = () => {
        setIsDayModalOpen(false);
        setSelectedDay(null);
        setNewProduction({
            recipeId: '',
            quantity: 0,
            location: 'internal',
            contractorId: ''
        });
    };

    // Get contractors (Фито, ТС)
    const contractors = warehouses.filter(w => w.id === 'wh-fito' || w.id === 'wh-ts');

    // Get materials availability for selected recipe
    const getMaterialsAvailability = (recipeId: string) => {
        const recipe = MOCK_RECIPES.find(r => r.id === recipeId);
        if (!recipe) return { internal: [], contractor: [] };

        const availability = {
            internal: recipe.ingredients.map(ing => {
                const item = items.find(i => i.id === ing.itemId);
                const itemStock = stock.filter(s => s.itemId === ing.itemId && (s.warehouseId === 'wh-kotsyubinske' || s.warehouseId === 'wh-ceh'));
                const totalStock = itemStock.reduce((acc, curr) => acc + curr.quantity, 0);
                return {
                    itemName: item?.name || ing.itemId,
                    required: ing.quantity,
                    available: totalStock,
                    unit: item?.unit || 'шт'
                };
            }),
            contractor: recipe.ingredients.map(ing => {
                const item = items.find(i => i.id === ing.itemId);
                const contractorStock = stock.filter(s => {
                    if (newProduction.location === 'contractor' && newProduction.contractorId) {
                        const contractor = contractors.find(c => c.id === newProduction.contractorId);
                        return s.itemId === ing.itemId && s.warehouseId === contractor?.id;
                    }
                    return false;
                });
                const totalStock = contractorStock.reduce((acc, curr) => acc + curr.quantity, 0);
                return {
                    itemName: item?.name || ing.itemId,
                    required: ing.quantity,
                    available: totalStock,
                    unit: item?.unit || 'шт'
                };
            })
        };

        return availability;
    };

    const materialsAvailability = newProduction.recipeId ? getMaterialsAvailability(newProduction.recipeId) : { internal: [], contractor: [] };

    const selectedDayProductions = selectedDay 
        ? dayProductions.filter(p => p.date === selectedDay.toISOString().split('T')[0])
        : [];

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-slate-100">
                        {t('calendar.title') || 'Календарь'}
                    </h1>
                    <p className="text-slate-400 mt-1">
                        {t('calendar.subtitle') || 'Планирование производства и логистики'}
                    </p>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                            <Calendar className="w-5 h-5" />
                            {monthName}
                        </CardTitle>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => navigateMonth('prev')}
                                className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
                            >
                                <ChevronLeft className="w-5 h-5 text-slate-400" />
                            </button>
                            <button
                                onClick={() => setCurrentDate(new Date())}
                                className="px-3 py-1 text-sm bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
                            >
                                {t('calendar.today') || 'Сегодня'}
                            </button>
                            <button
                                onClick={() => navigateMonth('next')}
                                className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
                            >
                                <ChevronRight className="w-5 h-5 text-slate-400" />
                            </button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="space-y-6">
                        {weeks.map((week, weekIndex) => (
                            <div key={weekIndex} className="border border-slate-700 rounded-lg p-4 bg-slate-800/30">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-lg font-semibold text-sm">
                                        {t('calendar.week') || 'Неделя'} {week.weekNumber}
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
                                <div className="grid grid-cols-7 gap-2">
                                    {dayNames.map((dayName, dayIndex) => {
                                        const day = week.days[dayIndex];
                                        const isDayToday = isToday(day);
                                        const isDayCurrentMonth = isCurrentMonth(day);
                                        const dayStr = day.toISOString().split('T')[0];
                                        const dayProds = dayProductions.filter(p => p.date === dayStr);
                                        
                                        return (
                                            <div
                                                key={dayIndex}
                                                onClick={() => handleDayClick(day)}
                                                className={clsx(
                                                    "p-3 rounded-lg border min-h-[80px] cursor-pointer hover:bg-slate-700/50 transition-colors",
                                                    isDayToday 
                                                        ? "bg-emerald-500/10 border-emerald-500/50" 
                                                        : "bg-slate-800/50 border-slate-700",
                                                    !isDayCurrentMonth && "opacity-40"
                                                )}
                                            >
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className={clsx(
                                                        "text-xs font-medium",
                                                        isDayToday ? "text-emerald-400" : "text-slate-400"
                                                    )}>
                                                        {dayName}
                                                    </span>
                                                    <span className={clsx(
                                                        "text-sm font-semibold",
                                                        isDayToday ? "text-emerald-400" : isDayCurrentMonth ? "text-slate-200" : "text-slate-500"
                                                    )}>
                                                        {day.getDate()}
                                                    </span>
                                                </div>
                                                {dayProds.length > 0 && (
                                                    <div className="space-y-1">
                                                        {dayProds.slice(0, 2).map((prod, idx) => {
                                                            const recipe = MOCK_RECIPES.find(r => r.id === prod.recipeId);
                                                            return (
                                                                <div key={idx} className="text-xs bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded truncate">
                                                                    {recipe?.name || 'Unknown'}
                                                                </div>
                                                            );
                                                        })}
                                                        {dayProds.length > 2 && (
                                                            <div className="text-xs text-slate-500">
                                                                +{dayProds.length - 2}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Day Modal */}
            {selectedDay && (
                <Modal
                    isOpen={isDayModalOpen}
                    onClose={handleCloseModal}
                    title={selectedDay.toLocaleDateString(language === 'uk' ? 'uk-UA' : 'ru-RU', { 
                        weekday: 'long', 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                    })}
                >
                    <div className="space-y-6">
                        {/* Existing Productions */}
                        {selectedDayProductions.length > 0 && (
                            <div>
                                <h4 className="text-sm font-medium text-slate-400 mb-3">
                                    {t('calendar.scheduledProduction') || 'Запланированное производство'}
                                </h4>
                                <div className="space-y-2">
                                    {selectedDayProductions.map((prod, idx) => {
                                        const recipe = MOCK_RECIPES.find(r => r.id === prod.recipeId);
                                        const contractor = contractors.find(c => c.id === prod.contractorId);
                                        return (
                                            <div key={idx} className="bg-slate-800/50 p-3 rounded-lg border border-slate-700">
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <p className="text-slate-200 font-medium">{recipe?.name || 'Unknown'}</p>
                                                        <p className="text-xs text-slate-400">
                                                            {prod.quantity} кг • {prod.location === 'internal' 
                                                                ? (t('calendar.internal') || 'У нас')
                                                                : (contractor?.name || t('calendar.contractor') || 'У подрядчика')}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Add New Production */}
                        <div>
                            <h4 className="text-sm font-medium text-slate-400 mb-3">
                                {t('calendar.addProduction') || 'Добавить производство'}
                            </h4>
                            <form onSubmit={handleAddProduction} className="space-y-4">
                                <Select
                                    label={t('calendar.recipe') || 'Рецепт'}
                                    options={[
                                        { value: '', label: t('calendar.selectRecipe') || 'Выберите рецепт...' },
                                        ...MOCK_RECIPES.map(r => ({ value: r.id, label: r.name }))
                                    ]}
                                    value={newProduction.recipeId}
                                    onChange={e => setNewProduction({ ...newProduction, recipeId: e.target.value })}
                                    required
                                />
                                
                                <Input
                                    label={t('calendar.quantity') || 'Количество (кг)'}
                                    type="number"
                                    min="1"
                                    value={newProduction.quantity || ''}
                                    onChange={e => setNewProduction({ ...newProduction, quantity: parseFloat(e.target.value) || 0 })}
                                    required
                                />

                                <Select
                                    label={t('calendar.location') || 'Место производства'}
                                    options={[
                                        { value: 'internal', label: t('calendar.internal') || 'У нас' },
                                        { value: 'contractor', label: t('calendar.contractor') || 'У подрядчика' }
                                    ]}
                                    value={newProduction.location}
                                    onChange={e => setNewProduction({ 
                                        ...newProduction, 
                                        location: e.target.value as 'internal' | 'contractor',
                                        contractorId: e.target.value === 'contractor' ? newProduction.contractorId : ''
                                    })}
                                    required
                                />

                                {newProduction.location === 'contractor' && (
                                    <Select
                                        label={t('calendar.contractor') || 'Подрядчик'}
                                        options={[
                                            { value: '', label: t('calendar.selectContractor') || 'Выберите подрядчика...' },
                                            ...contractors.map(c => ({ value: c.id, label: c.name }))
                                        ]}
                                        value={newProduction.contractorId}
                                        onChange={e => setNewProduction({ ...newProduction, contractorId: e.target.value })}
                                        required
                                    />
                                )}

                                {/* Materials Availability */}
                                {newProduction.recipeId && (
                                    <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
                                        <h5 className="text-sm font-medium text-slate-300 mb-3">
                                            {t('calendar.materialsAvailability') || 'Наличие материалов'}
                                        </h5>
                                        <div className="space-y-3">
                                            {(newProduction.location === 'internal' ? materialsAvailability.internal : materialsAvailability.contractor).map((mat, idx) => (
                                                <div key={idx} className="flex items-center justify-between text-sm">
                                                    <span className="text-slate-400">{mat.itemName}</span>
                                                    <div className="flex items-center gap-2">
                                                        <span className={clsx(
                                                            "font-semibold",
                                                            mat.available >= mat.required ? "text-emerald-400" : "text-red-400"
                                                        )}>
                                                            {mat.available} {mat.unit}
                                                        </span>
                                                        <span className="text-slate-500">/</span>
                                                        <span className="text-slate-400">
                                                            {mat.required} {mat.unit}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="flex justify-end gap-3 pt-4">
                                    <Button 
                                        type="button" 
                                        variant="ghost" 
                                        onClick={handleCloseModal}
                                    >
                                        {t('common.close') || 'Закрыть'}
                                    </Button>
                                    <Button type="submit">
                                        {t('calendar.add') || 'Добавить'}
                                    </Button>
                                </div>
                            </form>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
}
