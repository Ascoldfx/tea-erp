import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { FileSpreadsheet, Users, UserPlus, Database } from 'lucide-react';
import { useAuth, type UserRole } from '../../context/AuthContext';
import { seedService } from '../../services/seedService';
import { clsx } from 'clsx';

export default function SettingsPage() {
    const { user, login } = useAuth();
    const [activeTab, setActiveTab] = useState<'general' | 'users' | 'dev'>('users');
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState<UserRole>('warehouse');

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            alert(`File "${file.name}" selected. Import logic to be implemented.`);
        }
    };

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
        { id: 4, name: 'Мария (Планирование)', role: 'planner', email: 'maria@tea.com' },
        { id: 5, name: 'Иван Петрович (Директор)', role: 'director', email: 'ivan@tea.com' },
    ];

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-slate-100">Настройки</h1>
                <p className="text-slate-400 mt-1">Конфигурация системы и управление доступом</p>
            </div>

            <div className="flex gap-4 border-b border-slate-800">
                <button
                    className={clsx(
                        'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
                        activeTab === 'users' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-400 hover:text-slate-200'
                    )}
                    onClick={() => setActiveTab('users')}
                >
                    Пользователи
                </button>
                <button
                    className={clsx(
                        'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
                        activeTab === 'general' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-400 hover:text-slate-200'
                    )}
                    onClick={() => setActiveTab('general')}
                >
                    Импорт и Общие
                </button>
                <button
                    className={clsx(
                        'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
                        activeTab === 'dev' ? 'border-amber-500 text-amber-400' : 'border-transparent text-slate-400 hover:text-slate-200'
                    )}
                    onClick={() => setActiveTab('dev')}
                >
                    Dev Tools (Roles)
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
                                            { value: 'planner', label: 'Планировщик (Производство)' },
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
                                <FileSpreadsheet className="text-emerald-500" />
                                Импорт материалов
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="max-w-md space-y-4">
                                <p className="text-sm text-slate-400">
                                    Загрузите .xlsx файл для массового обновления справочника материалов и остатков.
                                </p>
                                <div className="flex gap-4 items-center">
                                    <Input
                                        type="file"
                                        accept=".xlsx, .xls"
                                        onChange={handleFileUpload}
                                        className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-emerald-900/40 file:text-emerald-400 hover:file:bg-emerald-900/60"
                                    />
                                    <Button variant="outline">
                                        Загрузить
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
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
    )
}

{
    activeTab === 'dev' && (
        <Card className="border-amber-500/50">
            <CardHeader>
                <CardTitle className="text-amber-400">Инструменты разработчика (Role Switcher)</CardTitle>
            </CardHeader>
            <CardContent>
                <p className="text-sm text-slate-400 mb-4">
                    Текущая роль: <span className="text-slate-100 font-bold uppercase">{user?.role}</span>
                </p>
                <div className="flex flex-wrap gap-2">
                    {(['admin', 'warehouse', 'procurement', 'planner', 'director'] as UserRole[]).map(role => (
                        <Button
                            key={role}
                            variant={user?.role === role ? 'primary' : 'outline'}
                            onClick={() => login(role)}
                        >
                            Login as {role}
                        </Button>
                    ))}
                </div>
            </CardContent>
        </Card>
    )
}
        </div >
    );
}
