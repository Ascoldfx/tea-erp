import { useState, useEffect } from 'react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Users, Plus, Search, Shield, UserCheck, UserX } from 'lucide-react';
import { usersService, type UserProfile } from '../../services/usersService';
import CreateUserModal from './CreateUserModal';
import EditUserModal from './EditUserModal';

export default function UsersPage() {
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            const data = await usersService.getAllUsers();
            setUsers(data);
        } catch (error) {
            console.error('Error fetching users:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleUserCreated = () => {
        setIsCreateModalOpen(false);
        fetchUsers();
    };

    const handleUserUpdated = () => {
        setIsEditModalOpen(false);
        setSelectedUser(null);
        fetchUsers();
    };

    const handleEditUser = (user: UserProfile) => {
        setSelectedUser(user);
        setIsEditModalOpen(true);
    };

    const handleToggleActive = async (user: UserProfile) => {
        try {
            if (user.is_active) {
                await usersService.deactivateUser(user.id);
            } else {
                await usersService.activateUser(user.id);
            }
            fetchUsers();
        } catch (error) {
            console.error('Error toggling user status:', error);
        }
    };

    const filteredUsers = users.filter(u =>
        !searchTerm ||
        u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        usersService.getRoleLabel(u.role).toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getRoleColor = (role: string) => {
        const colors: Record<string, string> = {
            admin: 'bg-red-500/20 text-red-400 border-red-500/30',
            procurement: ' bg-blue-500/20 text-blue-400 border-blue-500/30',
            production_planner: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
            director: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
        };
        return colors[role] || 'bg-slate-500/20 text-slate-400';
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-slate-100">Пользователи</h1>
                    <p className="text-slate-400 mt-1">Управление пользователями и ролями</p>
                </div>
                <Button onClick={() => setIsCreateModalOpen(true)} className="bg-blue-600 hover:bg-blue-700">
                    <Plus className="w-4 h-4 mr-2" />
                    Создать пользователя
                </Button>
            </div>

            {/* Search */}
            <div className="flex gap-4">
                <div className="flex-1">
                    <Input
                        placeholder="Поиск по email, имени или роли..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {/* Users List */}
            <div className="grid gap-4">
                {loading ? (
                    <div className="text-center py-12 text-slate-400">Загрузка...</div>
                ) : filteredUsers.length === 0 ? (
                    <div className="text-center py-12 text-slate-500">
                        <Users className="w-12 h-12 mx-auto mb-4 opacity-20" />
                        <p>Нет пользователей</p>
                    </div>
                ) : (
                    filteredUsers.map(user => (
                        <div
                            key={user.id}
                            className={`bg-slate-900 border rounded-lg p-6 transition-colors ${user.is_active ? 'border-slate-800 hover:border-slate-700' : 'border-slate-800/50 opacity-60'
                                }`}
                        >
                            <div className="flex justify-between items-start">
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-3">
                                        <Shield className="w-5 h-5 text-blue-400" />
                                        <h3 className="text-lg font-semibold text-slate-100">
                                            {user.full_name || user.email}
                                        </h3>
                                        <span className={`px-3 py-1 border rounded-full text-xs font-medium ${getRoleColor(user.role)}`}>
                                            {usersService.getRoleLabel(user.role)}
                                        </span>
                                        {!user.is_active && (
                                            <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs rounded border border-red-500/30">
                                                Неактивен
                                            </span>
                                        )}
                                    </div>

                                    <div className="text-sm text-slate-400 mb-4">
                                        {user.email}
                                    </div>

                                    {/* Role Permissions */}
                                    <div className="bg-slate-800/50 p-3 rounded">
                                        <div className="text-xs text-slate-500 mb-2">Права доступа:</div>
                                        <ul className="text-sm text-slate-300 space-y-1">
                                            {usersService.getRolePermissions(user.role).map((perm, idx) => (
                                                <li key={idx} className="flex items-center gap-2">
                                                    <span className="w-1 h-1 bg-blue-400 rounded-full"></span>
                                                    {perm}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>

                                    <div className="mt-3 text-xs text-slate-500">
                                        Создан: {new Date(user.created_at).toLocaleDateString('ru-RU')}
                                    </div>
                                </div>

                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        onClick={() => handleEditUser(user)}
                                        className="border-slate-600 text-slate-300 hover:text-white"
                                    >
                                        Редактировать
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        onClick={() => handleToggleActive(user)}
                                        className={user.is_active ? 'text-red-400 hover:text-red-300' : 'text-emerald-400 hover:text-emerald-300'}
                                    >
                                        {user.is_active ? (
                                            <>
                                                <UserX className="w-4 h-4 mr-2" />
                                                Деактивировать
                                            </>
                                        ) : (
                                            <>
                                                <UserCheck className="w-4 h-4 mr-2" />
                                                Активировать
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            <CreateUserModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                onUserCreated={handleUserCreated}
            />

            {selectedUser && (
                <EditUserModal
                    isOpen={isEditModalOpen}
                    onClose={() => {
                        setIsEditModalOpen(false);
                        setSelectedUser(null);
                    }}
                    user={selectedUser}
                    onUserUpdated={handleUserUpdated}
                />
            )}
        </div>
    );
}
