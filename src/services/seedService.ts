import { supabase } from '../lib/supabase';
import { MOCK_ITEMS, MOCK_WAREHOUSES, MOCK_STOCK } from '../data/mockInventory';
import { MOCK_CONTRACTORS } from '../data/mockContractors';

export const seedService = {
    async seedDatabase() {
        if (!supabase) throw new Error('Supabase not connected');

        console.log('Starting Seed...');

        // 1. Clear existing data (optional, but good for "Reset")
        // Note: DELETE cascade might be needed if tables are linked foreign keys
        // We'll just upsert for now to be safe, or delete if user confirms.
        // Let's rely on UPSERT.

        // 2. Warehouses
        const { error: whError } = await supabase
            .from('warehouses')
            .upsert(MOCK_WAREHOUSES.map(w => ({
                id: w.id,
                name: w.name,
                type: (w as any).type || 'main', // Fallback or cast
                location: w.location,
                capacity: (w as any).capacity || 0
            })));
        if (whError) throw new Error('Error seeding warehouses: ' + whError.message);

        // 3. Items
        const { error: itemError } = await supabase
            .from('items')
            .upsert(MOCK_ITEMS.map(i => ({
                id: i.id,
                sku: i.sku,
                name: i.name,
                category: i.category,
                description: i.description,
                unit: i.unit,
                min_stock_level: i.minStockLevel
            })));
        if (itemError) throw new Error('Error seeding items: ' + itemError.message);

        // 4. Stock Levels
        const { error: stockError } = await supabase
            .from('stock_levels')
            .upsert(MOCK_STOCK.map(s => ({
                id: s.id,
                warehouse_id: s.warehouseId,
                item_id: s.itemId,
                quantity: s.quantity,
                updated_at: s.lastUpdated
            })));
        if (stockError) throw new Error('Error seeding stock: ' + stockError.message);

        // 5. Contractors (if table exists)
        // Check if table exists by trying to select 1
        const { error: checkError } = await supabase.from('contractors').select('id').limit(1);
        if (!checkError) {
            const { error: contractorError } = await supabase
                .from('contractors')
                .upsert(MOCK_CONTRACTORS.map(c => ({
                    id: c.id,
                    name: c.name,
                    code: (c as any).code || c.id,
                    role: (c as any).role || 'supplier',
                    contact_person: c.contactPerson,
                    phone: c.phone,
                    email: c.email
                })));
            if (contractorError) console.warn('Contractor seed error:', contractorError);
        }

        // 6. Orders & Order Items (Seed History)
        console.log('Seeding Orders...');
        const { error: orderError } = await supabase
            .from('orders')
            .upsert([
                { id: '11111111-1111-1111-1111-111111111111', contractor_id: 'cnt-001', status: 'delivered', total_amount: 15000, order_date: new Date(Date.now() - 86400000 * 5).toISOString() },
                { id: '22222222-2222-2222-2222-222222222222', contractor_id: 'cnt-002', status: 'shipped', total_amount: 5000, order_date: new Date(Date.now() - 86400000 * 2).toISOString() }
            ]);
        if (!orderError) {
            // Basic Items
            await supabase.from('order_items').upsert([
                { order_id: '11111111-1111-1111-1111-111111111111', item_id: 'tea-001', quantity: 100, price_per_unit: 100 },
                { order_id: '11111111-1111-1111-1111-111111111111', item_id: 'pak-soft-100g', quantity: 500, price_per_unit: 2 }
            ]);
        }

        // 7. Stock Movements (Seed History)
        console.log('Seeding Movements...');
        await supabase.from('stock_movements').upsert([
            { item_id: 'tea-001', quantity: 100, type: 'in', target_warehouse_id: 'wh-main', comment: 'Initial Stock' },
            { item_id: 'tea-002', quantity: 50, type: 'in', target_warehouse_id: 'wh-main', comment: 'Initial Stock' },
            { item_id: 'tea-001', quantity: 10, type: 'out', source_warehouse_id: 'wh-main', comment: 'Production Use' }
        ]);

        console.log('Seed Complete');
        return true;
    },

    async clearDatabase() {
        if (!supabase) throw new Error('Supabase not connected');

        // Delete in order to avoid FK constraints
        try {
            await supabase.from('order_items').delete().neq('id', '00000000-0000-0000-0000-000000000000');
            await supabase.from('stock_movements').delete().neq('id', '00000000-0000-0000-0000-000000000000');
            await supabase.from('orders').delete().neq('id', '00000000-0000-0000-0000-000000000000');
            await supabase.from('stock_levels').delete().neq('id', '00000000-0000-0000-0000-000000000000');
            await supabase.from('items').delete().neq('id', '00000000-0000-0000-0000-000000000000');
            await supabase.from('warehouses').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        } catch (e) {
            console.warn('Clear Error', e);
        }
        return true;
    }
};
