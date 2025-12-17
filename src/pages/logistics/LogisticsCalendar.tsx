import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { clsx } from 'clsx';

export default function LogisticsCalendar() {
    const { t, language } = useLanguage();
    const [currentDate, setCurrentDate] = useState(new Date());

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

    // Get week number (ISO week)
    function getWeekNumber(date: Date): number {
        const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        const dayNum = d.getUTCDay() || 7;
        d.setUTCDate(d.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    }

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

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-slate-100">
                        {t('logistics.calendar.title') || 'Логистический календарь'}
                    </h1>
                    <p className="text-slate-400 mt-1">
                        {t('logistics.calendar.subtitle') || 'Планирование и отслеживание логистических операций'}
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
                                {t('logistics.calendar.today') || 'Сегодня'}
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
                                        {t('logistics.calendar.week') || 'Неделя'} {week.weekNumber}
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
                                        
                                        return (
                                            <div
                                                key={dayIndex}
                                                className={clsx(
                                                    "p-3 rounded-lg border min-h-[80px]",
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
                                                {/* Placeholder for logistics events */}
                                                <div className="text-xs text-slate-500">
                                                    {/* Events will be added here */}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

