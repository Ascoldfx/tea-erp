import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
}

export function Input({ className, label, id, type, ...props }: InputProps) {
    const isNumber = type === 'number';
    // If value is 0 and we want to show empty, we can handle it here, 
    // but better to control it from parent or use a refined value.
    // However, user specifically asked to remove "0" symbol.
    // We can conditionally modify the `value` prop passed to input.

    const displayValue = (isNumber && props.value === 0) ? '' : props.value;

    return (
        <div className={className}>
            {label && <label htmlFor={id} className="block text-sm font-medium text-slate-400 mb-1">{label}</label>}
            <input
                id={id}
                type={type}
                className="w-full bg-slate-800 border-slate-700 text-slate-100 rounded-md focus:ring-emerald-500 focus:border-emerald-500 placeholder-slate-500"
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
                {...props}
            />
        </div>
    );
}
