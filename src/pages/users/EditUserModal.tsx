import { useState, useEffect } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Loader2, Key } from 'lucide-react';
import { usersService, type UserProfile, type UpdateUserData } from '../../services/usersService';

interface EditUserModalProps {
    isOpen: boolean;
    onClose: () => void;
    user: UserProfile;
    onUserUpdated: () => void;
}

export default function EditUserModal({ isOpen, onClose, user, onUserUpdated }: EditUserModalProps) {
    const [formData, setFormData] = useState<UpdateUserData>({
        full_name: user.full_name || '',
        role: user.role,
        is_active: user.is_active
    });
    const [newPassword, setNewPassword] = useState('');
    const [showPasswordReset, setShowPasswordReset] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setFormData({
            full_name: user.full_name || '',
            role: user.role,
            is_active: user.is_active
        });
    }, [user]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            await usersService.updateUser(user.id, formData);

            if (newPassword && showPasswordReset) {
                await usersService.resetPassword(user.id, newPassword);
            }

            onUserUpdated();
        } catch (err: any) {
            console.error('Error updating user:', err);
            setError(err.message || 'Ошибка при обновлении пользователя');
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        setShowPasswordReset(false);
        setNewPassword('');
        setError(null);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={handleClose} title="Редактировать пользователя">
            <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                    <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded">
                        {error}
                    </div>
                )}

                <div className="bg-slate-800/50 p-3 rounded text-sm text-slate-400">
                    Email: <span className="text-slate-200">{user.email}</span>
                </div>

                <Input
                    label="Полное имя"
                    value={formData.full_name || ''}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    placeholder="Иван Иванов"
                />

                <Select
                    label="Роль"
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                    options={[
                        { value: 'director', label: 'Директор (только чтение)' },
                        { value: 'procurement', label: 'Менеджер по закупкам' },
                        { value: 'production_planner', label: 'Планировщик производства' },
                        { value: 'admin', label: 'Администратор' }
                    ]}
                />

                <div className="bg-slate-800/50 p-3 rounded text-sm">
                    <div className="text-slate-400 mb-2">Права для роли "{usersService.getRoleLabel(formData.role || user.role)}":</div>
                    <ul className="text-slate-300 space-y-1">
                        {usersService.getRolePermissions(formData.role || user.role).map((perm, idx) => (
                            <li key={idx} className="flex items-center gap-2">
                                <span className="w-1 h-1 bg-blue-400 rounded-full"></span>
                                {perm}
                            </li>
                        ))}
                    </ul>
                </div>

                {/* Password Reset Section */}
                <div className="border-t border-slate-700 pt-4">
                    {!showPasswordReset ? (
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setShowPasswordReset(true)}
                            className="w-full border-amber-600 text-amber-400 hover:bg-amber-600/10"
                        >
                            <Key className="w-4 h-4 mr-2" />
                            Сбросить пароль
                        </Button>
                    ) : (
                        <div className="space-y-2">
                            <Input
                                label="Новый пароль"
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                placeholder="Минимум 6 символов"
                            />
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={() => {
                                    setShowPasswordReset(false);
                                    setNewPassword('');
                                }}
                                className="text-sm text-slate-400"
                            >
                                Отменить сброс пароля
                            </Button>
                        </div>
                    )}
                </div>

                <div className="flex gap-3 pt-4">
                    <Button type="submit" disabled={loading} className="flex-1 bg-blue-600 hover:bg-blue-700">
                        {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Сохранить
                    </Button>
                    <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
                        Отмена
                    </Button>
                </div>
            </form>
        </Modal>
    );
}
