```javascript
import { NavLink } from 'react-router-dom';
import { Package, Factory, Truck, Settings, LogOut, Book, Calculator, ShoppingCart, Users, BarChart3 } from 'lucide-react';
import { clsx } from 'clsx';
import { useAuth } from '../../context/AuthContext';

const navItems = [
    { to: '/orders', icon: ShoppingCart, label: 'Заказы' },
    { to: '/inventory', icon: Package, label: 'Материалы' },
    { to: '/suppliers', icon: Truck, label: 'Поставщики' },
    { to: '/production', icon: Factory, label: 'Производство' },
    { to: '/calculator', icon: Calculator, label: 'Калькулятор' },
    { to: '/contractors', icon: Users, label: 'Подрядчики' },
    { to: '/catalog', icon: Book, label: 'Тех. карты' },
    { to: '/users', icon: Users, label: 'Пользователи', requireAdmin: true },
    { to: '/settings', icon: Settings, label: 'Настройки' },
];

interface SidebarProps {
    isOpen?: boolean;
    onClose?: () => void;
    className?: string; // Add className prop definition
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
    const { user, logout, hasPermission } = useAuth();

    // Filter nav items based on permissions/role
    const filteredNavItems = navItems.filter(item => {
        if (item.requireAdmin) return user?.role === 'admin';
        if (item.label === 'Настройки') return hasPermission('manage_users');
        if (item.label === 'Подрядчики') return user?.role !== 'warehouse';
        // Director sees everything else mostly (read only)
        return true;
    });

    return (
        <div className={clsx(
            "h-screen w-64 bg-slate-900 border-r border-slate-800 flex flex-col fixed left-0 top-0 transition-transform duration-300 z-50",
            // Mobile: slide in/out based on isOpen. Desktop: always visible (translate-0)
            isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}>
            <div className="p-6">
                <nav className="space-y-2 mt-4">
                    {filteredNavItems.map((item) => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            onClick={() => onClose?.()} // Close sidebar on nav click (mobile)
                            className={({ isActive }) =>
                                clsx(
                                    'flex items-center gap-3 px-4 py-4 rounded-xl text-base font-medium transition-colors',
                                    isActive
                                        ? 'bg-emerald-500/10 text-emerald-500'
                                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                                )
                            }
                        >
                            <item.icon className="w-6 h-6" />
                            {item.label}
                        </NavLink>
                    ))}
                </nav>
            </div>
            <div className="p-4 border-t border-slate-800 mt-auto">
                {user && (
                    <div className="flex items-center gap-3 mb-4 px-2">
                        <img
                            src={user.avatarUrl}
                            alt={user.name}
                            className="w-8 h-8 rounded-full bg-slate-700"
                        />
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-200 truncate">{user.name}</p>
                            <p className="text-xs text-slate-500 truncate">{user.email}</p>
                        </div>
                    </div>
                )}
                <button
                    onClick={logout}
                    className="flex items-center gap-3 w-full px-3 py-2 text-sm font-medium text-slate-400 rounded-lg hover:bg-slate-800 hover:text-red-400 transition-colors"
                >
                    <LogOut className="w-5 h-5 transition-transform group-hover:rotate-180" />
                    Выйти
                </button>
            </div>
        </div>
    );
}
