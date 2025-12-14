import React from 'react';
import { clsx } from 'clsx';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
    label?: string;
    options?: { value: string; label: string }[];
}

export function Select({ className, label, id, options, children, ...props }: SelectProps) {
    return (
        <div className="space-y-1">
            {label && (
                <label htmlFor={id} className="block text-sm font-medium text-slate-300">
                    {label}
                </label>
            )}
            <select
                id={id}
                className={clsx(
                    'flex h-10 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:cursor-not-allowed disabled:opacity-50',
                    className
                )}
                {...props}
            >
                {options ? options.map((option) => (
                    <option key={option.value} value={option.value}>
                        {option.label}
                    </option>
                )) : children}
            </select>
        </div>
    );
}
