import React from 'react';
import { clsx } from 'clsx';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
    size?: 'sm' | 'md' | 'lg';
}

export function Button({
    className,
    variant = 'primary',
    size = 'md',
    ...props
}: ButtonProps) {
    const variants = {
        primary: 'bg-emerald-600 text-white hover:bg-emerald-500 active:bg-emerald-700',
        secondary: 'bg-slate-800 text-slate-100 hover:bg-slate-700 active:bg-slate-600',
        outline: 'border border-slate-700 bg-transparent hover:bg-slate-800 text-slate-300',
        ghost: 'bg-transparent hover:bg-slate-800 text-slate-300',
        danger: 'bg-red-600 text-white hover:bg-red-500',
    };

    const sizes = {
        sm: 'h-8 px-3 text-sm',
        md: 'h-10 px-4',
        lg: 'h-12 px-6 text-lg',
    };

    return (
        <button
            className={clsx(
                'inline-flex items-center justify-center rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none',
                variants[variant],
                sizes[size],
                className
            )}
            {...props}
        />
    );
}
