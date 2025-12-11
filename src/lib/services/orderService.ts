/**
 * Order Service
 * Handles all order-related API operations
 */

import { api } from '../api-client';

export interface Order {
  id: string;
  product_id: string;
  negotiation_id?: string;
  buyer_id: string;
  seller_id: string;
  final_price: number;
  status: 'pending' | 'processing' | 'completed' | 'cancelled';
  admin_note?: string;
  created_at: string;
  updated_at: string;
}

export interface OrderWithRelations extends Order {
  product?: {
    id: string;
    name: string;
  };
  negotiation?: {
    id: string;
    offered_price: number;
  };
  buyer?: {
    id: string;
    full_name: string;
    phone: string;
  };
  seller?: {
    id: string;
    full_name: string;
    phone: string;
  };
}

export interface OrderFilters {
  product_id?: string;
  buyer_id?: string;
  seller_id?: string;
  status?: 'pending' | 'processing' | 'completed' | 'cancelled';
  page?: number;
  limit?: number;
}

export interface CreateOrderPayload {
  product_id: string;
  negotiation_id?: string;
  final_price: number;
}

export interface UpdateOrderStatusPayload {
  status: 'pending' | 'processing' | 'completed' | 'cancelled';
  admin_note?: string;
}

export const orderService = {
  /**
   * Get list of orders with filters
   */
  async getOrders(filters?: OrderFilters) {
    return api.get<OrderWithRelations[]>('/orders', filters);
  },

  /**
   * Get single order by ID
   */
  async getOrderById(id: string) {
    return api.get<OrderWithRelations>(`/orders/${id}`);
  },

  /**
   * Create new order
   */
  async createOrder(payload: CreateOrderPayload) {
    return api.post<Order>('/orders', payload);
  },

  /**
   * Update order status (admin only)
   */
  async updateOrderStatus(id: string, payload: UpdateOrderStatusPayload) {
    return api.put<Order>(`/orders/${id}/status`, payload);
  },
};
