import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Package, Factory, Truck, Settings, LogOut, Book, Calculator } from 'lucide-react';
import { clsx } from 'clsx';
import { useAuth } from '../../context/AuthContext';

const navItems = [
    { to: '/', icon: LayoutDashboard, label: 'Дашборд' },
    { to: '/inventory', icon: Package, label: 'Материалы' },
    { to: '/production', icon: Factory, label: 'Производство' },
    { to: '/calculator', icon: Calculator, label: 'Калькулятор' },
    { to: '/contractors', icon: Truck, label: 'Подрядчики' },
    { to: '/catalog', icon: Book, label: 'Тех. карты' },
    { to: '/settings', icon: Settings, label: 'Настройки' },
];

export default function Sidebar() {
    const { user, logout, hasPermission } = useAuth();

    // Filter nav items based on permissions/role
    const filteredNavItems = navItems.filter(item => {
        if (item.label === 'Настройки') return hasPermission('manage_users');
        if (item.label === 'Подрядчики') return user?.role !== 'warehouse';
        // Director sees everything else mostly (read only)
        return true;
    });

    return (
        <div className="h-screen w-64 bg-slate-900 border-r border-slate-800 flex flex-col fixed left-0 top-0">
            <div className="p-6">
                <div className="flex items-center gap-3 mb-8">
                    <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
                        <span className="text-white font-bold">T</span>
                    </div>
                    <span className="text-xl font-bold text-slate-100">Tea ERP</span>
                </div>

                <nav className="space-y-1">
                    {filteredNavItems.map((item) => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            className={({ isActive }) =>
                                clsx(
                                    'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors',
                                    isActive
                                        ? 'bg-emerald-500/10 text-emerald-500'
                                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                                )
                            }
                        >
                            <item.icon className="w-5 h-5" />
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
