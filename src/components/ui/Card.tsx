import React from 'react';
import { clsx } from 'clsx';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> { }

export function Card({ className, ...props }: CardProps) {
    return (
        <div
            className={clsx('bg-slate-900 rounded-xl shadow-lg border border-slate-800', className)}
            {...props}
        />
    );
}

export function CardHeader({ className, ...props }: CardProps) {
    return <div className={clsx('p-6 border-b border-slate-800', className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
    return <h3 className={clsx('text-lg font-semibold text-slate-100', className)} {...props} />;
}

export function CardContent({ className, ...props }: CardProps) {
    return <div className={clsx('p-6', className)} {...props} />;
}
