import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { FileSpreadsheet, Users, UserPlus, Database, Globe } from 'lucide-react';
import { useAuth, type UserRole } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { seedService } from '../../services/seedService';
import ExcelImportModal from '../inventory/ExcelImportModal';
import { clsx } from 'clsx';

export default function SettingsPage() {
    const { user } = useAuth();
    const { language, setLanguage, t } = useLanguage();
    const [activeTab, setActiveTab] = useState<'general' | 'users' | 'dev'>('users');
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState<UserRole>('warehouse');
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);

    const handleInvite = (e: React.FormEvent) => {
        e.preventDefault();
        alert(`Приглашение отправлено на ${inviteEmail} с ролью ${inviteRole}`);
        setInviteEmail('');
    };

    const handleSeedData = async () => {
        if (!confirm('Это действие заполнит базу данных тестовыми материалами. Продолжить?')) return;
        try {
            await seedService.seedDatabase();
            alert('База данных успешно обновлена тестовыми данными!');
        } catch (e: any) {
            console.error(e);
            alert('Ошибка: ' + e.message);
        }
    };

    // Mock Users List for display
    const MOCK_USERS_LIST = [
        { id: 1, name: 'Anton (Admin)', role: 'admin', email: 'anton@tea.com' },
        { id: 2, name: 'Склад', role: 'warehouse', email: 'warehouse@tea.com' },
        { id: 3, name: 'Олег (Закупки)', role: 'procurement', email: 'oleg@tea.com' },
        { id: 4, name: 'Мария (Планирование)', role: 'production_planner', email: 'maria@tea.com' },
        { id: 5, name: 'Иван Петрович (Директор)', role: 'director', email: 'ivan@tea.com' },
    ];

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-slate-100">{t('settings.title')}</h1>
                <p className="text-slate-400 mt-1">{t('settings.subtitle')}</p>
            </div>

            <div className="flex gap-4 border-b border-slate-800">
                <button
                    className={clsx(
                        'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
                        activeTab === 'users' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-400 hover:text-slate-200'
                    )}
                    onClick={() => setActiveTab('users')}
                >
                    {t('settings.tab.users')}
                </button>
                <button
                    className={clsx(
                        'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
                        activeTab === 'general' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-400 hover:text-slate-200'
                    )}
                    onClick={() => setActiveTab('general')}
                >
                    {t('settings.tab.general')}
                </button>
                <button
                    className={clsx(
                        'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
                        activeTab === 'dev' ? 'border-amber-500 text-amber-400' : 'border-transparent text-slate-400 hover:text-slate-200'
                    )}
                    onClick={() => setActiveTab('dev')}
                >
                    {t('settings.tab.dev')}
                </button>
            </div>

            {activeTab === 'users' && (
                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <UserPlus className="text-blue-500" />
                                Пригласить пользователя
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleInvite} className="flex gap-4 items-end">
                                <div className="flex-1">
                                    <Input
                                        label="Email Google аккаунта"
                                        placeholder="user@gmail.com"
                                        value={inviteEmail}
                                        onChange={(e) => setInviteEmail(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="w-64">
                                    <Select
                                        label="Роль"
                                        options={[
                                            { value: 'admin', label: 'Администратор (Полный доступ)' },
                                            { value: 'warehouse', label: 'Склад (Только приемка)' },
                                            { value: 'procurement', label: 'Закупки (Материалы)' },
                                            { value: 'production_planner', label: 'Планировщик (Производство)' },
                                            { value: 'director', label: 'Директор (Просмотр)' }
                                        ]}
                                        value={inviteRole}
                                        onChange={(e) => setInviteRole(e.target.value as UserRole)}
                                    />
                                </div>
                                <Button type="submit">
                                    Отправить
                                </Button>
                            </form>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Users className="text-slate-400" />
                                Список пользователей
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-slate-900 border-b border-slate-800 text-slate-400 uppercase">
                                        <tr>
                                            <th className="px-6 py-3">Пользователь</th>
                                            <th className="px-6 py-3">Email</th>
                                            <th className="px-6 py-3">Роль</th>
                                            <th className="px-6 py-3 text-right">Статус</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800">
                                        {MOCK_USERS_LIST.map(u => (
                                            <tr key={u.id} className="hover:bg-slate-800/50">
                                                <td className="px-6 py-4 font-medium text-slate-200">{u.name}</td>
                                                <td className="px-6 py-4 text-slate-400">{u.email}</td>
                                                <td className="px-6 py-4">
                                                    <span className={clsx(
                                                        "px-2 py-1 rounded text-xs font-bold uppercase",
                                                        u.role === 'admin' ? "bg-red-900/30 text-red-400" :
                                                            u.role === 'director' ? "bg-purple-900/30 text-purple-400" :
                                                                "bg-slate-700 text-slate-300"
                                                    )}>
                                                        {u.role}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-right text-emerald-400 text-xs">Активен</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {activeTab === 'general' && (
                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Globe className="text-blue-500" />
                                {t('settings.language')}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="max-w-md space-y-4">
                                <p className="text-sm text-slate-400">
                                    {language === 'ru' 
                                        ? 'Выберите язык интерфейса приложения'
                                        : 'Виберіть мову інтерфейсу додатку'
                                    }
                                </p>
                                <div className="flex gap-3">
                                    <Button
                                        onClick={() => setLanguage('ru')}
                                        className={clsx(
                                            "flex-1",
                                            language === 'ru' 
                                                ? "bg-blue-600 hover:bg-blue-700 text-white" 
                                                : "bg-slate-800 hover:bg-slate-700 text-slate-300"
                                        )}
                                    >
                                        {t('settings.language.ru')}
                                    </Button>
                                    <Button
                                        onClick={() => setLanguage('uk')}
                                        className={clsx(
                                            "flex-1",
                                            language === 'uk' 
                                                ? "bg-blue-600 hover:bg-blue-700 text-white" 
                                                : "bg-slate-800 hover:bg-slate-700 text-slate-300"
                                        )}
                                    >
                                        {t('settings.language.uk')}
                                    </Button>
                                </div>
                                <p className="text-xs text-slate-500">
                                    {language === 'ru'
                                        ? 'Изменения вступят в силу после обновления страницы'
                                        : 'Зміни набудуть чинності після оновлення сторінки'
                                    }
                                </p>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <FileSpreadsheet className="text-emerald-500" />
                                {language === 'ru' ? 'Импорт материалов' : 'Імпорт матеріалів'}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="max-w-md space-y-4">
                                <p className="text-sm text-slate-400">
                                    {language === 'ru'
                                        ? 'Загрузите .xlsx файл для массового обновления справочника материалов и остатков.'
                                        : 'Завантажте .xlsx файл для масового оновлення довідника матеріалів та залишків.'
                                    }
                                </p>
                                <p className="text-xs text-slate-500">
                                    {language === 'ru'
                                        ? 'Поддерживаются большие файлы, несколько вкладок и формулы. Будет использована первая вкладка или можно выбрать нужную.'
                                        : 'Підтримуються великі файли, кілька вкладок та формули. Буде використана перша вкладка або можна вибрати потрібну.'
                                    }
                                </p>
                                <Button 
                                    onClick={() => setIsImportModalOpen(true)}
                                    className="bg-emerald-600 hover:bg-emerald-700"
                                >
                                    <FileSpreadsheet className="w-4 h-4 mr-2" />
                                    {language === 'ru' ? 'Импортировать из Excel' : 'Імпортувати з Excel'}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Database className="text-blue-500" />
                                Управление данными (Демо)
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="font-medium text-slate-200">Генерация тестовых данных</p>
                                    <p className="text-sm text-slate-400">
                                        Создать начальные материалы, склады и остатки для тестирования.
                                    </p>
                                </div>
                                <Button onClick={handleSeedData} className="bg-blue-600 hover:bg-blue-700 text-white">
                                    Сгенерировать данные
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {activeTab === 'dev' && (
                <Card className="border-amber-500/50">
                    <CardHeader>
                        <CardTitle className="text-amber-400">Инструменты разработчика</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-slate-400 mb-4">
                            Текущая роль: <span className="text-slate-100 font-bold uppercase">{user?.role}</span>
                        </p>
                        <p className="text-sm text-amber-400 mb-4">
                            ⚠️ Role switcher отключен. Используйте реальную аутентификацию через страницу входа.
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {(['admin', 'warehouse', 'procurement', 'production_planner', 'director'] as UserRole[]).map(role => (
                                <Button
                                    key={role}
                                    variant="outline"
                                    disabled
                                    className="opacity-50"
                                >
                                    {role} (требует реального пользователя)
                                </Button>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Excel Import Modal */}
            <ExcelImportModal 
                isOpen={isImportModalOpen} 
                onClose={() => setIsImportModalOpen(false)} 
            />
        </div>
    );
}
