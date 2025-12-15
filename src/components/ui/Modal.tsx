import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
}

export function Modal({ isOpen, onClose, title, children }: ModalProps) {
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };

        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
            document.body.style.overflow = 'hidden';
        }

        return () => {
            document.removeEventListener('keydown', handleEscape);
            document.body.style.overflow = 'unset';
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <div
                className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            />
            <div className="relative w-full max-w-2xl max-h-[90vh] transform rounded-xl bg-slate-900 border border-slate-800 shadow-2xl transition-all flex flex-col">
                {/* Fixed Header */}
                <div className="flex items-center justify-between p-6 pb-5 border-b border-slate-800 flex-shrink-0">
                    <h3 className="text-lg font-semibold leading-6 text-slate-100">
                        {title}
                    </h3>
                    <button
                        onClick={onClose}
                        className="rounded-full p-1 hover:bg-slate-800 transition-colors"
                    >
                        <X className="h-5 w-5 text-slate-400" />
                    </button>
                </div>
                {/* Scrollable Content */}
                <div className="overflow-y-auto flex-1 p-6 pt-5">
                    {children}
                </div>
            </div>
        </div>
    );
}
