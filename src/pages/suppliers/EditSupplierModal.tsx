import { useState, useEffect } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { supabase } from '../../lib/supabase';
import { Loader2 } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

interface Contractor {
    id: string;
    name: string;
    contact_person?: string;
    phone?: string;
    email?: string;
    code?: string;
}

interface EditSupplierModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    supplier: Contractor | null;
}

export default function EditSupplierModal({ isOpen, onClose, onSuccess, supplier }: EditSupplierModalProps) {
    const { t } = useLanguage();
    const [name, setName] = useState('');
    const [contactPerson, setContactPerson] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [saving, setSaving] = useState(false);

    // Load supplier data when modal opens
    useEffect(() => {
        if (supplier && isOpen) {
            setName(supplier.name || '');
            setContactPerson(supplier.contact_person || '');
            setPhone(supplier.phone || '');
            setEmail(supplier.email || '');
        }
    }, [supplier, isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!supabase || !supplier) {
            alert(t('common.dbConnectionError'));
            return;
        }

        setSaving(true);

        try {
            const { error } = await supabase
                .from('contractors')
                .update({
                    name,
                    contact_person: contactPerson || null,
                    phone: phone || null,
                    email: email || null,
                })
                .eq('id', supplier.id);

            if (error) {
                console.error('Supabase error details:', {
                    message: error.message,
                    details: error.details,
                    hint: error.hint,
                    code: error.code
                });
                throw new Error(error.message || 'Ошибка при обновлении поставщика');
            }

            console.log('Supplier updated successfully');

            alert(t('editSupplier.success'));
            onSuccess();
            onClose();
        } catch (error: any) {
            console.error('Error updating supplier:', error);
            let errorMessage = t('editSupplier.error');
            
            if (error?.message) {
                errorMessage = error.message;
            } else if (error?.details) {
                errorMessage = error.details;
            } else if (typeof error === 'string') {
                errorMessage = error;
            }
            
            if (error?.hint) {
                errorMessage += `\n\n${t('common.hint')}: ${error.hint}`;
            }
            
            alert(`${t('editSupplier.error')}:\n\n${errorMessage}\n\n${t('common.checkConsole')}`);
        } finally {
            setSaving(false);
        }
    };

    if (!supplier) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={t('editSupplier.title', { supplierName: supplier.name })}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                    label={t('editSupplier.companyName')}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    placeholder={t('editSupplier.companyNamePlaceholder')}
                />

                <Input
                    label={t('editSupplier.contactPerson')}
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                    placeholder={t('editSupplier.contactPersonPlaceholder')}
                />

                <Input
                    label={t('editSupplier.phone')}
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder={t('editSupplier.phonePlaceholder')}
                />

                <Input
                    label={t('editSupplier.email')}
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t('editSupplier.emailPlaceholder')}
                />

                <div className="flex justify-end gap-3 pt-4">
                    <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
                        {t('common.cancel')}
                    </Button>
                    <Button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-700">
                        {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        {t('common.saveChanges')}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}

