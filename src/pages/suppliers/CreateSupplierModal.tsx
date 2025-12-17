import { useState } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { supabase } from '../../lib/supabase';
import { Loader2 } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

interface CreateSupplierModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export default function CreateSupplierModal({ isOpen, onClose, onSuccess }: CreateSupplierModalProps) {
    const { t } = useLanguage();
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
            // Generate unique ID
            const id = `cnt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            
            // Generate code from name (handle Cyrillic and special chars)
            let code = name
                .substring(0, 20)
                .toUpperCase()
                .replace(/\s+/g, '_')
                .replace(/[^A-Z0-9_А-ЯЁ]/g, '')
                .replace(/[А-ЯЁ]/g, (char) => {
                    // Simple transliteration for Cyrillic
                    const map: Record<string, string> = {
                        'А': 'A', 'Б': 'B', 'В': 'V', 'Г': 'G', 'Д': 'D', 'Е': 'E', 'Ё': 'E',
                        'Ж': 'ZH', 'З': 'Z', 'И': 'I', 'Й': 'Y', 'К': 'K', 'Л': 'L', 'М': 'M',
                        'Н': 'N', 'О': 'O', 'П': 'P', 'Р': 'R', 'С': 'S', 'Т': 'T', 'У': 'U',
                        'Ф': 'F', 'Х': 'H', 'Ц': 'TS', 'Ч': 'CH', 'Ш': 'SH', 'Щ': 'SCH',
                        'Ъ': '', 'Ы': 'Y', 'Ь': '', 'Э': 'E', 'Ю': 'YU', 'Я': 'YA'
                    };
                    return map[char] || '';
                });
            
            // If code is empty or too short, use fallback
            if (!code || code.length < 3) {
                code = `SUPPLIER_${id.slice(-8)}`;
            }
            
            // Ensure code is unique by checking existing codes
            const { data: existing } = await supabase
                .from('contractors')
                .select('code')
                .eq('code', code)
                .limit(1);
            
            if (existing && existing.length > 0) {
                code = `${code}_${Date.now().toString().slice(-6)}`;
            }

            console.log('Creating supplier with:', { id, name, code, contactPerson, phone, email });

            const { data, error } = await supabase
                .from('contractors')
                .insert({
                    id,
                    name,
                    code,
                    contact_person: contactPerson || null,
                    phone: phone || null,
                    email: email || null,
                })
                .select()
                .single();

            if (error) {
                console.error('Supabase error details:', {
                    message: error.message,
                    details: error.details,
                    hint: error.hint,
                    code: error.code
                });
                throw new Error(error.message || 'Ошибка при создании поставщика');
            }

            console.log('Supplier created successfully:', data);

            alert('Поставщик успешно добавлен!');
            setName('');
            setContactPerson('');
            setPhone('');
            setEmail('');
            onSuccess();
            onClose();
        } catch (error: any) {
            console.error('Error creating supplier:', error);
            let errorMessage = 'Ошибка при создании поставщика.';
            
            if (error?.message) {
                errorMessage = error.message;
            } else if (error?.details) {
                errorMessage = error.details;
            } else if (typeof error === 'string') {
                errorMessage = error;
            }
            
            // Add hint if available
            if (error?.hint) {
                errorMessage += `\n\nПодсказка: ${error.hint}`;
            }
            
            alert(`Ошибка при создании поставщика:\n\n${errorMessage}\n\nПроверьте консоль браузера (F12) для деталей.`);
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={t('suppliers.createTitle')}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                    label={t('suppliers.companyName') + ' *'}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    placeholder="ООО Поставщик"
                />

                <Input
                    label={t('suppliers.contactPerson')}
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                    placeholder="Иван Иванов"
                />

                <Input
                    label={t('suppliers.phone')}
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+380..."
                />

                <Input
                    label={t('suppliers.email')}
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="contact@supplier.com"
                />

                <div className="flex justify-end gap-3 pt-4">
                    <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
                        {t('common.cancel')}
                    </Button>
                    <Button type="submit" disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
                        {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        {t('common.create')}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}
