import { supabase } from '../lib/supabase';
import type { Recipe } from '../types/production';

export interface RecipeBackup {
    id: string;
    recipe_id: string;
    recipe_data: any;
    ingredients_data: any[];
    backup_type: 'auto' | 'manual';
    created_at: string;
    created_by?: string;
    notes?: string;
    is_protected?: boolean;
    retention_days?: number;
    expires_at?: string;
    backup_size_kb?: number;
}

export const recipesBackupService = {
    /**
     * Получить все бэкапы для техкарты
     */
    async getBackupsForRecipe(recipeId: string): Promise<RecipeBackup[]> {
        if (!supabase) {
            return [];
        }

        try {
            const { data, error } = await supabase
                .from('recipes_backup')
                .select('*')
                .eq('recipe_id', recipeId)
                .order('created_at', { ascending: false });

            if (error) {
                console.error('[BackupService] Error fetching backups:', error);
                return [];
            }

            return data || [];
        } catch (error) {
            console.error('[BackupService] Exception fetching backups:', error);
            return [];
        }
    },

    /**
     * Получить все бэкапы (с фильтрацией)
     */
    async getAllBackups(options?: {
        protectedOnly?: boolean;
        expiredOnly?: boolean;
        limit?: number;
    }): Promise<RecipeBackup[]> {
        if (!supabase) {
            return [];
        }

        try {
            let query = supabase
                .from('recipes_backup')
                .select('*')
                .order('created_at', { ascending: false });

            if (options?.protectedOnly) {
                query = query.eq('is_protected', true);
            }

            if (options?.expiredOnly) {
                query = query.lt('expires_at', new Date().toISOString());
            }

            if (options?.limit) {
                query = query.limit(options.limit);
            }

            const { data, error } = await query;

            if (error) {
                console.error('[BackupService] Error fetching backups:', error);
                return [];
            }

            return data || [];
        } catch (error) {
            console.error('[BackupService] Exception fetching backups:', error);
            return [];
        }
    },

    /**
     * Восстановить техкарту из бэкапа
     */
    async restoreFromBackup(backupId: string): Promise<Recipe | null> {
        if (!supabase) {
            return null;
        }

        try {
            // Получаем бэкап
            const { data: backup, error: backupError } = await supabase
                .from('recipes_backup')
                .select('*')
                .eq('id', backupId)
                .single();

            if (backupError || !backup) {
                console.error('[BackupService] Error fetching backup:', backupError);
                return null;
            }

            // Восстанавливаем техкарту
            const { recipesService } = await import('./recipesService');
            
            const recipe: Recipe = {
                id: backup.recipe_data.id,
                name: backup.recipe_data.name,
                description: backup.recipe_data.description,
                outputItemId: backup.recipe_data.output_item_id,
                outputQuantity: backup.recipe_data.output_quantity,
                actualQuantity: backup.recipe_data.actual_quantity,
                materialsHandoverDate: backup.recipe_data.materials_handover_date,
                materialsAcceptedDate: backup.recipe_data.materials_accepted_date,
                ingredients: (backup.ingredients_data || []).map((ing: any) => ({
                    itemId: ing.item_id,
                    quantity: ing.quantity,
                    tolerance: ing.tolerance,
                    isDuplicateSku: ing.is_duplicate_sku,
                    isAutoCreated: ing.is_auto_created,
                    tempMaterial: ing.temp_material_sku && ing.temp_material_name
                        ? { sku: ing.temp_material_sku, name: ing.temp_material_name }
                        : undefined
                }))
            };

            // Сохраняем восстановленную техкарту
            const success = await recipesService.saveRecipe(recipe);
            if (!success) {
                console.error('[BackupService] Error restoring recipe');
                return null;
            }

            console.log(`[BackupService] Recipe restored from backup ${backupId}`);
            return recipe;
        } catch (error) {
            console.error('[BackupService] Exception restoring from backup:', error);
            return null;
        }
    },

    /**
     * Защитить бэкап от автоматического удаления
     */
    async protectBackup(backupId: string): Promise<boolean> {
        if (!supabase) {
            return false;
        }

        try {
            const { error } = await supabase
                .from('recipes_backup')
                .update({ is_protected: true })
                .eq('id', backupId);

            if (error) {
                console.error('[BackupService] Error protecting backup:', error);
                return false;
            }

            return true;
        } catch (error) {
            console.error('[BackupService] Exception protecting backup:', error);
            return false;
        }
    },

    /**
     * Снять защиту с бэкапа
     */
    async unprotectBackup(backupId: string): Promise<boolean> {
        if (!supabase) {
            return false;
        }

        try {
            const { error } = await supabase
                .from('recipes_backup')
                .update({ is_protected: false })
                .eq('id', backupId);

            if (error) {
                console.error('[BackupService] Error unprotecting backup:', error);
                return false;
            }

            return true;
        } catch (error) {
            console.error('[BackupService] Exception unprotecting backup:', error);
            return false;
        }
    },

    /**
     * Удалить истекшие бэкапы (только незащищенные)
     */
    async cleanupExpiredBackups(): Promise<number> {
        if (!supabase) {
            return 0;
        }

        try {
            const { data, error } = await supabase.rpc('cleanup_expired_backups');

            if (error) {
                console.error('[BackupService] Error cleaning up backups:', error);
                return 0;
            }

            return data || 0;
        } catch (error) {
            console.error('[BackupService] Exception cleaning up backups:', error);
            return 0;
        }
    },

    /**
     * Получить статистику бэкапов
     */
    async getBackupStats(): Promise<{
        total: number;
        protected: number;
        expired: number;
        totalSizeKb: number;
        oldestBackup?: string;
        newestBackup?: string;
    }> {
        if (!supabase) {
            return { total: 0, protected: 0, expired: 0, totalSizeKb: 0 };
        }

        try {
            const { data, error } = await supabase
                .from('recipes_backup')
                .select('is_protected, expires_at, backup_size_kb, created_at');

            if (error) {
                console.error('[BackupService] Error fetching stats:', error);
                return { total: 0, protected: 0, expired: 0, totalSizeKb: 0 };
            }

            const now = new Date();
            const protectedCount = data?.filter(b => b.is_protected).length || 0;
            const expiredCount = data?.filter(b => 
                !b.is_protected && b.expires_at && new Date(b.expires_at) < now
            ).length || 0;
            const totalSizeKb = data?.reduce((sum, b) => sum + (b.backup_size_kb || 0), 0) || 0;
            
            const dates = data?.map(b => b.created_at).filter(Boolean) || [];
            const oldestBackup = dates.length > 0 ? dates.sort()[0] : undefined;
            const newestBackup = dates.length > 0 ? dates.sort().reverse()[0] : undefined;

            return {
                total: data?.length || 0,
                protected: protectedCount,
                expired: expiredCount,
                totalSizeKb,
                oldestBackup,
                newestBackup
            };
        } catch (error) {
            console.error('[BackupService] Exception fetching stats:', error);
            return { total: 0, protected: 0, expired: 0, totalSizeKb: 0 };
        }
    }
};

