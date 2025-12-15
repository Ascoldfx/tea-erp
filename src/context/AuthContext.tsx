import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import type { UserProfile } from '../services/usersService';

export type UserRole = 'admin' | 'warehouse' | 'procurement' | 'production_planner' | 'director';

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
    warehouse: ['receive_goods'],
    procurement: ['edit_materials', 'view_financials'],
    production_planner: ['plan_production', 'edit_materials'],
    director: ['view_financials']
};

interface AuthContextType {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (email: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
    hasPermission: (permission: Permission) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Load user profile from database
    const loadUserProfile = async (userId: string): Promise<User | null> => {
        if (!supabase) return null;

        try {
            const { data: profile, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .eq('is_active', true)
                .single();

            if (error || !profile) {
                console.error('Error loading profile:', error);
                return null;
            }

            return {
                id: profile.id,
                name: profile.full_name || profile.email,
                email: profile.email,
                role: profile.role as UserRole,
                avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.full_name || profile.email)}&background=0D9488&color=fff`
            };
        } catch (error) {
            console.error('Error loading user profile:', error);
            return null;
        }
    };

    // Check for existing session on mount
    useEffect(() => {
        if (!supabase) {
            setIsLoading(false);
            return;
        }

        const checkSession = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                
                if (session?.user) {
                    const userProfile = await loadUserProfile(session.user.id);
                    if (userProfile) {
                        setUser(userProfile);
                    }
                }
            } catch (error) {
                console.error('Error checking session:', error);
            } finally {
                setIsLoading(false);
            }
        };

        checkSession();

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (event === 'SIGNED_IN' && session?.user) {
                const userProfile = await loadUserProfile(session.user.id);
                if (userProfile) {
                    setUser(userProfile);
                }
            } else if (event === 'SIGNED_OUT') {
                setUser(null);
            }
        });

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    const login = async (email: string, password: string) => {
        if (!supabase) {
            throw new Error('Supabase не инициализирован. Проверьте переменные окружения VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY');
        }

        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password
            });

            if (error) {
                console.error('Supabase auth error:', error);
                // Более понятные сообщения об ошибках
                if (error.message.includes('Invalid login credentials')) {
                    throw new Error('Неверный email или пароль');
                } else if (error.message.includes('Email not confirmed')) {
                    throw new Error('Email не подтвержден. Проверьте почту.');
                } else {
                    throw new Error(error.message || 'Ошибка входа');
                }
            }

            if (!data.user) {
                throw new Error('Вход не выполнен. Попробуйте еще раз.');
            }

            const userProfile = await loadUserProfile(data.user.id);
            if (!userProfile) {
                throw new Error('Профиль пользователя не найден или неактивен. Обратитесь к администратору.');
            }

            setUser(userProfile);
        } catch (err: any) {
            // Обработка сетевых ошибок
            if (err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError')) {
                throw new Error('Ошибка подключения к серверу. Проверьте интернет-соединение и настройки Supabase.');
            }
            throw err;
        }
    };

    const logout = async () => {
        if (!supabase) return;

        await supabase.auth.signOut();
        setUser(null);
    };

    const hasPermission = (permission: Permission): boolean => {
        if (!user) return false;
        return ROLE_PERMISSIONS[user.role]?.includes(permission) || false;
    };

    return (
        <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, login, logout, hasPermission }}>
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
