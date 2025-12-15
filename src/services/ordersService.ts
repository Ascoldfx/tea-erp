import { supabase } from '../lib/supabase';

export interface OrderItem {
    id: string;
    order_id: string;
    item_id: string;
    quantity: number;
    price_per_unit: number;
    received_quantity: number;
    item?: {
        name: string;
        sku: string;
        unit: string;
    };
}

export interface OrderWithItems {
    id: string;
    contractor_id: string;
    status: 'draft' | 'ordered' | 'shipped' | 'delivered' | 'cancelled';
    total_amount: number;
    order_date: string;
    contractor?: {
        name: string;
    };
    items: OrderItem[];
}

export const ordersService = {
    async getOrderWithItems(orderId: string): Promise<OrderWithItems | null> {
        if (!supabase) return null;

        console.log('🔍 Fetching order:', orderId);

        const { data: order, error: orderError } = await supabase
            .from('orders')
            .select(`
                id,
                contractor_id,
                status,
                total_amount,
                order_date,
                contractors (name)
            `)
            .eq('id', orderId)
            .single();

        if (orderError) {
            console.error('❌ Error fetching order:', orderError);
            console.error('Error details:', JSON.stringify(orderError, null, 2));
            return null;
        }

        console.log('✅ Order fetched successfully:', order);

        const { data: items, error: itemsError } = await supabase
            .from('order_items')
            .select(`
                id,
                order_id,
                item_id,
                quantity,
                price_per_unit,
                items (name, sku, unit)
            `)
            .eq('order_id', orderId);

        if (itemsError) {
            console.error('❌ Error fetching order items:', itemsError);
            console.error('Error details:', JSON.stringify(itemsError, null, 2));
            return null;
        }

        console.log('✅ Order items fetched:', items);

        // Map items and set received_quantity to 0 if column doesn't exist yet
        return {
            ...order,
            contractor: order.contractors as any,
            items: items.map(item => ({
                ...item,
                received_quantity: (item as any).received_quantity || 0,
                item: item.items as any
            }))
        };
    },

    async updateOrderStatus(orderId: string, status: string): Promise<boolean> {
        if (!supabase) return false;

        const { error } = await supabase
            .from('orders')
            .update({ status })
            .eq('id', orderId);

        if (error) {
            console.error('Error updating order status:', error);
            return false;
        }

        return true;
    },

    async updateReceivedQuantities(items: Array<{ id: string; received_quantity: number }>): Promise<boolean> {
        if (!supabase) return false;

        try {
            for (const item of items) {
                const { error } = await supabase
                    .from('order_items')
                    .update({ received_quantity: item.received_quantity })
                    .eq('id', item.id);

                if (error) throw error;
            }
            return true;
        } catch (e) {
            console.error('Error updating received quantities:', e);
            return false;
        }
    },

    async closeOrder(orderId: string): Promise<boolean> {
        return this.updateOrderStatus(orderId, 'delivered');
    },

    async cancelOrder(orderId: string): Promise<boolean> {
        return this.updateOrderStatus(orderId, 'cancelled');
    }
};
