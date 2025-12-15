import { useState } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { supabase } from '../../lib/supabase';
import { Loader2 } from 'lucide-react';

interface CreateSupplierModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export default function CreateSupplierModal({ isOpen, onClose, onSuccess }: CreateSupplierModalProps) {
    const [name, setName] = useState('');
    const [contactPerson, setContactPerson] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!supabase) {
            alert('Ошибка: нет соединения с базой данных');
            return;
        }

        setSaving(true);

        try {
            const { error } = await supabase
                .from('contractors')
                .insert({
                    name,
                    code: name.substring(0, 10).toUpperCase().replace(/\s/g, '_'),
                    contact_person: contactPerson || null,
                    phone: phone || null,
                    email: email || null,
                });

            if (error) throw error;

            alert('Поставщик успешно добавлен!');
            setName('');
            setContactPerson('');
            setPhone('');
            setEmail('');
            onSuccess();
            onClose();
        } catch (error) {
            console.error('Error creating supplier:', error);
            alert('Ошибка при создании поставщика');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Добавить поставщика">
            <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                    label="Название компании *"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    placeholder="ООО Поставщик"
                />

                <Input
                    label="Контактное лицо"
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                    placeholder="Иван Иванов"
                />

                <Input
                    label="Телефон"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+380..."
                />

                <Input
                    label="Email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="contact@supplier.com"
                />

                <div className="flex justify-end gap-3 pt-4">
                    <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
                        Отмена
                    </Button>
                    <Button type="submit" disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
                        {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Создать
                    </Button>
                </div>
            </form>
        </Modal>
    );
}
