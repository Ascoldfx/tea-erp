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

        // Create user in auth.users
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
            email: userData.email,
            password: userData.password,
            email_confirm: true,
            user_metadata: {
                full_name: userData.full_name,
                role: userData.role
            }
        });

        if (authError) throw authError;

        // Profile will be created automatically by trigger
        // Wait a bit and fetch it
        await new Promise(resolve => setTimeout(resolve, 500));

        const profile = await this.getUserById(authData.user.id);
        if (!profile) throw new Error('Profile not created');

        return { user: authData.user, profile };
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

        const { error } = await supabase.auth.admin.updateUserById(userId, {
            password: newPassword
        });

        if (error) throw error;
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
