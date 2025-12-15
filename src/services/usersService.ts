import { supabase } from '../lib/supabase';

export interface UserProfile {
    id: string;
    email: string;
    full_name: string | null;
    role: 'admin' | 'procurement' | 'production_planner' | 'warehouse' | 'director';
    warehouse_id: string | null;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface CreateUserData {
    email: string;
    password: string;
    full_name: string;
    role: 'admin' | 'procurement' | 'production_planner' | 'warehouse' | 'director';
    warehouse_id?: string | null;
}

export interface UpdateUserData {
    full_name?: string;
    role?: 'admin' | 'procurement' | 'production_planner' | 'warehouse' | 'director';
    warehouse_id?: string | null;
    is_active?: boolean;
}

class UsersService {
    async getAllUsers(): Promise<UserProfile[]> {
        if (!supabase) throw new Error('Supabase not initialized');

        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
    }

    async getUserById(id: string): Promise<UserProfile | null> {
        if (!supabase) throw new Error('Supabase not initialized');

        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;
        return data;
    }

    async createUser(userData: CreateUserData): Promise<{ user: any; profile: UserProfile }> {
        if (!supabase) throw new Error('Supabase not initialized');

        // Get current session for authorization
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('Not authenticated');

        // Call Edge Function to create user
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const response = await fetch(`${supabaseUrl}/functions/v1/create-user`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`,
                'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY || ''
            },
            body: JSON.stringify({
                email: userData.email,
                password: userData.password,
                full_name: userData.full_name,
                role: userData.role,
                warehouse_id: userData.warehouse_id || null
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to create user');
        }

        const result = await response.json();
        return { user: result.user, profile: result.profile };
    }

    async updateUser(id: string, updates: UpdateUserData): Promise<UserProfile> {
        if (!supabase) throw new Error('Supabase not initialized');

        const { data, error } = await supabase
            .from('profiles')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    async deactivateUser(id: string): Promise<UserProfile> {
        return this.updateUser(id, { is_active: false });
    }

    async activateUser(id: string): Promise<UserProfile> {
        return this.updateUser(id, { is_active: true });
    }

    async resetPassword(userId: string, newPassword: string): Promise<void> {
        if (!supabase) throw new Error('Supabase not initialized');

        // Get current session for authorization
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('Not authenticated');

        // Call Edge Function to reset password
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const response = await fetch(`${supabaseUrl}/functions/v1/reset-password`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`,
                'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY || ''
            },
            body: JSON.stringify({
                userId,
                newPassword
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to reset password');
        }
    }

    getRoleLabel(role: string): string {
        const labels: Record<string, string> = {
            admin: 'Администратор',
            procurement: 'Менеджер по закупкам',
            production_planner: 'Планировщик производства',
            warehouse: 'Кладовщик',
            director: 'Директор'
        };
        return labels[role] || role;
    }

    getRolePermissions(role: string): string[] {
        const permissions: Record<string, string[]> = {
            admin: [
                'Полный доступ ко всем функциям',
                'Управление пользователями',
                'Назначение ролей'
            ],
            procurement: [
                'Создание и изменение заказов',
                'Просмотр материалов и запасов',
                'Изменение статуса заказов',
                'Управление поставщиками'
            ],
            production_planner: [
                'Просмотр запасов материалов',
                'Управление подрядчиками',
                'Просмотр заказов в работе',
                'Передача материалов подрядчикам'
            ],
            warehouse: [
                'Приём товаров на свой склад',
                'Подтверждение фактического количества',
                'Просмотр материалов на своём складе',
                'Перемещение между складами'
            ],
            director: [
                'Просмотр статусов',
                'Просмотр запасов материалов',
                'Просмотр отчетов'
            ]
        };
        return permissions[role] || [];
    }
}

export const usersService = new UsersService();
