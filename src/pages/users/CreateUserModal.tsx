import { useState } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Loader2 } from 'lucide-react';
import { usersService, type CreateUserData } from '../../services/usersService';

interface CreateUserModalProps {
    isOpen: boolean;
    onClose: () => void;
    onUserCreated: () => void;
}

export default function CreateUserModal({ isOpen, onClose, onUserCreated }: CreateUserModalProps) {
    const [formData, setFormData] = useState<CreateUserData>({
        email: '',
        password: '',
        full_name: '',
        role: 'director'
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            await usersService.createUser(formData);
            setFormData({ email: '', password: '', full_name: '', role: 'director' });
            onUserCreated();
        } catch (err: any) {
            console.error('Error creating user:', err);
            setError(err.message || 'Ошибка при создании пользователя');
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        setFormData({ email: '', password: '', full_name: '', role: 'director' });
        setError(null);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={handleClose} title="Создать пользователя">
            <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                    <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded">
                        {error}
                    </div>
                )}

                <Input
                    label="Email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                    placeholder="user@example.com"
                />

                <Input
                    label="Полное имя"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    required
                    placeholder="Иван Иванов"
                />

                <Input
                    label="Временный пароль"
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                    placeholder="Минимум 6 символов"
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
                    <div className="text-slate-400 mb-2">Права для роли "{usersService.getRoleLabel(formData.role)}":</div>
                    <ul className="text-slate-300 space-y-1">
                        {usersService.getRolePermissions(formData.role).map((perm, idx) => (
                            <li key={idx} className="flex items-center gap-2">
                                <span className="w-1 h-1 bg-blue-400 rounded-full"></span>
                                {perm}
                            </li>
                        ))}
                    </ul>
                </div>

                <div className="flex gap-3 pt-4">
                    <Button type="submit" disabled={loading} className="flex-1 bg-blue-600 hover:bg-blue-700">
                        {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Создать
                    </Button>
                    <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
                        Отмена
                    </Button>
                </div>
            </form>
        </Modal>
    );
}
