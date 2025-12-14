import { createContext, useContext, useState, type ReactNode } from 'react';

export type UserRole = 'admin' | 'warehouse' | 'procurement' | 'planner' | 'director';

export interface User {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    avatarUrl?: string;
}

export type Permission = 'manage_users' | 'edit_materials' | 'receive_goods' | 'plan_production' | 'view_financials';

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
    admin: ['manage_users', 'edit_materials', 'receive_goods', 'plan_production', 'view_financials'],
    warehouse: ['receive_goods'], // Can only receive goods. View is default.
    procurement: ['edit_materials', 'view_financials'],
    planner: ['plan_production', 'edit_materials'], // Planner needs to see/edit materials sometimes? Let's say yes for now, or just plan.
    director: ['view_financials'] // Read-only mostly
};

interface AuthContextType {
    user: User | null;
    isAuthenticated: boolean;
    login: (role?: UserRole) => void;
    logout: () => void;
    hasPermission: (permission: Permission) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);

    const login = (role: UserRole = 'admin') => {
        const mockUsers: Record<UserRole, User> = {
            admin: { id: 'u1', name: 'Антон (Admin)', email: 'admin@tea.com', role: 'admin', avatarUrl: 'https://ui-avatars.com/api/?name=Admin&background=0D9488&color=fff' },
            warehouse: { id: 'u2', name: 'Склад (Worker)', email: 'warehouse@tea.com', role: 'warehouse', avatarUrl: 'https://ui-avatars.com/api/?name=Warehouse&background=475569&color=fff' },
            procurement: { id: 'u3', name: 'Закупки (Manager)', email: 'buy@tea.com', role: 'procurement', avatarUrl: 'https://ui-avatars.com/api/?name=Buyer&background=2563eb&color=fff' },
            planner: { id: 'u4', name: 'Планировщик', email: 'plan@tea.com', role: 'planner', avatarUrl: 'https://ui-avatars.com/api/?name=Planner&background=d97706&color=fff' },
            director: { id: 'u5', name: 'Директор', email: 'boss@tea.com', role: 'director', avatarUrl: 'https://ui-avatars.com/api/?name=Boss&background=dc2626&color=fff' },
        };

        setUser(mockUsers[role]);
    };

    const logout = () => {
        setUser(null);
    };

    const hasPermission = (permission: Permission): boolean => {
        if (!user) return false;
        return ROLE_PERMISSIONS[user.role].includes(permission);
    };

    return (
        <AuthContext.Provider value={{ user, isAuthenticated: !!user, login, logout, hasPermission }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
