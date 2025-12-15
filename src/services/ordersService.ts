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

        // Fetch order with contractor
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

        // Fetch order items WITHOUT joining items table
        const { data: orderItems, error: itemsError } = await supabase
            .from('order_items')
            .select('id, order_id, item_id, quantity, price_per_unit')
            .eq('order_id', orderId);

        if (itemsError) {
            console.error('❌ Error fetching order items:', itemsError);
            console.error('Error details:', JSON.stringify(itemsError, null, 2));
            return null;
        }

        console.log('✅ Order items fetched:', orderItems);

        // Fetch item details separately
        const itemIds = orderItems.map(i => i.item_id);
        const { data: itemsData, error: itemsDataError } = await supabase
            .from('items')
            .select('id, name, sku, unit')
            .in('id', itemIds);

        if (itemsDataError) {
            console.error('❌ Error fetching items data:', itemsDataError);
            return null;
        }

        console.log('✅ Items data fetched:', itemsData);

        // Manually join the data
        const items = orderItems.map(orderItem => ({
            ...orderItem,
            received_quantity: (orderItem as any).received_quantity || 0,
            item: itemsData.find(item => item.id === orderItem.item_id)
        }));

        return {
            ...order,
            contractor: order.contractors as any,
            items
        };
    },

    async receiveOrder(orderId: string, warehouseId: string = 'wh-main'): Promise<boolean> {
        if (!supabase) return false;

        try {
            console.log('📦 Receiving order:', orderId, 'to warehouse:', warehouseId);

            // 1. Get order details
            const orderData = await this.getOrderWithItems(orderId);
            if (!orderData) {
                console.error('Order not found');
                return false;
            }

            // 2. Update status to delivered
            const { error: statusError } = await supabase
                .from('orders')
                .update({ status: 'delivered' })
                .eq('id', orderId);

            if (statusError) throw statusError;

            // 3. Update stock levels for each item
            for (const item of orderData.items) {
                const quantityToAdd = item.received_quantity || item.quantity;

                // Check if stock level exists
                const { data: existingStock } = await supabase
                    .from('stock_levels')
                    .select('quantity')
                    .eq('warehouse_id', warehouseId)
                    .eq('item_id', item.item_id)
                    .single();

                if (existingStock) {
                    // Update existing stock
                    const { error: updateError } = await supabase
                        .from('stock_levels')
                        .update({
                            quantity: existingStock.quantity + quantityToAdd
                        })
                        .eq('warehouse_id', warehouseId)
                        .eq('item_id', item.item_id);

                    if (updateError) throw updateError;
                } else {
                    // Create new stock level
                    const { error: insertError } = await supabase
                        .from('stock_levels')
                        .insert({
                            warehouse_id: warehouseId,
                            item_id: item.item_id,
                            quantity: quantityToAdd
                        });

                    if (insertError) throw insertError;
                }

                // 4. Create stock movement entry (history)
                const { error: movementError } = await supabase
                    .from('stock_movements')
                    .insert({
                        item_id: item.item_id,
                        quantity: quantityToAdd,
                        type: 'in',
                        target_warehouse_id: warehouseId,
                        comment: `Поступление по заказу ${orderId.slice(0, 8)}`
                    });

                if (movementError) {
                    console.warn('Could not create stock movement:', movementError);
                }
            }

            console.log('✅ Order received successfully');
            return true;
        } catch (e) {
            console.error('Error receiving order:', e);
            return false;
        }
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
