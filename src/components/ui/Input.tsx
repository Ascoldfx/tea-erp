import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
}

export function Input({ className, label, id, type, ...props }: InputProps) {
    const isNumber = type === 'number';
    const displayValue = (isNumber && (props.value === 0 || props.value === '0')) ? '' : props.value;

    return (
        <div className={className}>
            {label && <label htmlFor={id} className="block text-sm font-medium text-slate-400 mb-1">{label}</label>}
            <input
                id={id}
                type={type}
                className="flex h-10 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-slate-900"
                onKeyDown={(e) => {
                    if (type === 'number') {
                        // Allow: backspace, delete, tab, escape, enter, decimal point
                        if (['Backspace', 'Delete', 'Tab', 'Escape', 'Enter', '.', ','].includes(e.key)) return;
                        // Allow: Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X
                        if (['a', 'c', 'v', 'x'].includes(e.key) && (e.ctrlKey || e.metaKey)) return;
                        // Allow: home, end, left, right
                        if (['Home', 'End', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
                        // Block if not a number
                        if (!/^\d$/.test(e.key)) {
                            e.preventDefault();
                        }
                    }
                    props.onKeyDown?.(e);
                }}
                value={displayValue}
                {...props}
            />
        </div>
    );
}
