import { supabase } from '../lib/supabase';
import type { Contractor, ContractorJob, ContractorJobItem } from '../types/contractors';

export const contractorsService = {
    // ---- CONTRACTORS ----
    async getContractors(): Promise<Contractor[]> {
        if (!supabase) return [];
        const { data, error } = await supabase.from('contractors').select('*').order('name');
        if (error) {
            console.error('Error fetching contractors:', error);
            throw new Error('Ошибка при загрузке подрядчиков');
        }
        return (data || []).map(c => ({
            id: c.id,
            name: c.name,
            contactPerson: c.contact_person || '',
            email: c.email || '',
            phone: c.phone || '',
            address: c.address || '',
            balance: Number(c.balance) || 0,
            paymentTerms: c.payment_terms || 'postpayment',
            paymentDelayDays: Number(c.payment_delay_days) || 0
        }));
    },
    
    // ---- JOBS ----
    async getJobs(): Promise<ContractorJob[]> {
        if (!supabase) return [];
        
        // Use standard join syntax
        const { data, error } = await supabase
            .from('contractor_jobs')
            .select(`
                *,
                contractor_job_items (*)
            `)
            .order('date', { ascending: false });

        if (error) {
            console.error('Error fetching jobs:', error);
            throw new Error('Ошибка при загрузке задач подрядчиков');
        }

        return (data || []).map(j => ({
            id: j.id,
            contractorId: j.contractor_id,
            date: j.date,
            description: j.description || '',
            status: j.status,
            totalAmount: Number(j.total_amount) || 0,
            items: (j.contractor_job_items || []).map((i: any) => ({
                id: i.id,
                jobId: i.job_id,
                recipeId: i.recipe_id,
                quantityKg: Number(i.quantity_kg) || 0
            }))
        }));
    },

    async createJob(job: Omit<ContractorJob, 'id' | 'items'>, items: Omit<ContractorJobItem, 'id' | 'jobId'>[]): Promise<void> {
        if (!supabase) throw new Error('База данных не подключена');

        // 1. Insert job
        const { data: newJob, error: jobError } = await supabase
            .from('contractor_jobs')
            .insert({
                contractor_id: job.contractorId,
                date: job.date,
                description: job.description,
                status: job.status,
                total_amount: job.totalAmount
            })
            .select()
            .single();

        if (jobError) {
            console.error('Error creating job:', jobError);
            throw new Error('Ошибка при создании задачи: ' + jobError.message);
        }

        // 2. Insert items
        if (items && items.length > 0) {
            const itemsData = items.map(item => ({
                job_id: newJob.id,
                recipe_id: item.recipeId,
                quantity_kg: item.quantityKg
            }));

            const { error: itemsError } = await supabase
                .from('contractor_job_items')
                .insert(itemsData);

            if (itemsError) {
                console.error('Error creating job items:', itemsError);
                throw new Error('Ошибка при сохранении позиций задачи: ' + itemsError.message);
            }
        }
    }
};
