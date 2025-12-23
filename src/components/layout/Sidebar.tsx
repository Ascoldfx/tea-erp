import { NavLink } from 'react-router-dom';
import { Package, Factory, Truck, Settings, LogOut, Book, Calculator, ShoppingCart, Users, Calendar } from 'lucide-react';
import { clsx } from 'clsx';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';

const getNavItems = (t: (key: string) => string) => [
    { to: '/orders', icon: ShoppingCart, label: t('nav.orders') },
    { to: '/inventory', icon: Package, label: t('nav.materials') },
    { to: '/suppliers', icon: Truck, label: t('nav.suppliers') },
    { to: '/production', icon: Factory, label: t('nav.production') },
    { to: '/logistics', icon: Calendar, label: t('nav.logistics') },
    { to: '/calculator', icon: Calculator, label: t('nav.calculator') },
    { to: '/contractors', icon: Users, label: t('nav.contractors') },
    { to: '/production/recipes', icon: Book, label: t('nav.techCards') },
    { to: '/users', icon: Users, label: t('nav.users'), requireAdmin: true },
    { to: '/settings', icon: Settings, label: t('nav.settings') },
];

interface SidebarProps {
    isOpen?: boolean;
    onClose?: () => void;
    className?: string; // Add className prop definition
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
    const { user, logout, hasPermission } = useAuth();
    const { t } = useLanguage();
    const navItems = getNavItems(t);

    // Filter nav items based on permissions/role
    const filteredNavItems = navItems.filter(item => {
        if (item.requireAdmin) return user?.role === 'admin';
        if (item.to === '/settings') return hasPermission('manage_users');
        if (item.to === '/contractors') return user?.role !== 'warehouse';
        // Director sees everything else mostly (read only)
        return true;
    });

    return (
        <div className={clsx(
            "h-screen bg-slate-900 border-r border-slate-800 flex flex-col fixed left-0 top-0 transition-all duration-300 z-50 group",
            // Mobile: slide in/out based on isOpen
            // Desktop: collapsed by default (w-16), expanded on hover (lg:w-64)
            isOpen ? "translate-x-0 w-64" : "-translate-x-full lg:translate-x-0 lg:w-16 lg:hover:w-64"
        )}>
            <div className="p-6 lg:p-4">
                <nav className="space-y-2 mt-4">
                    {filteredNavItems.map((item) => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            onClick={() => onClose?.()} // Close sidebar on nav click (mobile)
                            className={({ isActive }) =>
                                clsx(
                                    'flex items-center gap-3 px-4 py-4 rounded-xl text-base font-medium transition-colors',
                                    'lg:justify-center lg:group-hover:justify-start',
                                    isActive
                                        ? 'bg-emerald-500/10 text-emerald-500'
                                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                                )
                            }
                        >
                            <item.icon className="w-6 h-6 flex-shrink-0" />
                            <span className="lg:opacity-0 lg:group-hover:opacity-100 lg:max-w-0 lg:group-hover:max-w-xs whitespace-nowrap overflow-hidden transition-all duration-300">
                                {item.label}
                            </span>
                        </NavLink>
                    ))}
                </nav>
            </div>
            <div className="p-4 border-t border-slate-800 mt-auto">
                {user && (
                    <div className="flex items-center gap-3 mb-4 px-2 lg:justify-center lg:group-hover:justify-start">
                        <img
                            src={user.avatarUrl}
                            alt={user.name}
                            className="w-8 h-8 rounded-full bg-slate-700 flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0 lg:opacity-0 lg:group-hover:opacity-100 lg:max-w-0 lg:group-hover:max-w-xs overflow-hidden transition-all duration-300">
                            <p className="text-sm font-medium text-slate-200 truncate">{user.name}</p>
                            <p className="text-xs text-slate-500 truncate">{user.email}</p>
                        </div>
                    </div>
                )}
                <button
                    onClick={logout}
                    className="flex items-center gap-3 w-full px-3 py-2 text-sm font-medium text-slate-400 rounded-lg hover:bg-slate-800 hover:text-red-400 transition-colors lg:justify-center lg:group-hover:justify-start"
                >
                    <LogOut className="w-5 h-5 flex-shrink-0" />
                    <span className="lg:opacity-0 lg:group-hover:opacity-100 lg:max-w-0 lg:group-hover:max-w-xs whitespace-nowrap overflow-hidden transition-all duration-300">
                        {t('nav.logout')}
                    </span>
                </button>
            </div>
        </div>
    );
}
