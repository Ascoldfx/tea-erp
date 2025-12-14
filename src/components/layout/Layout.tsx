import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import { Menu } from 'lucide-react';
import { clsx } from 'clsx';

export default function Layout() {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    return (
        <div className="flex h-screen bg-slate-950">
            {/* Mobile Header */}
            <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-slate-900 border-b border-slate-800 flex items-center px-4 z-40">
                <button
                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    className="p-2 text-slate-400 hover:text-slate-200"
                >
                    <Menu className="w-6 h-6" />
                </button>
                <span className="ml-4 font-bold text-slate-100 text-lg">Tea ERP</span>
            </div>

            <Sidebar
                isOpen={isMobileMenuOpen}
                onClose={() => setIsMobileMenuOpen(false)}
            />

            {/* Overlay for mobile sidebar */}
            {isMobileMenuOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-30 lg:hidden"
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}

            <main className={clsx(
                "flex-1 overflow-auto p-4 md:p-8 transition-all duration-300",
                "pt-20 lg:pt-8", // Mobile needs top padding for header
                "lg:ml-64 ml-0"   // Desktop needs margin for sidebar
            )}>
                <Outlet />
            </main>
        </div>
    );
}
