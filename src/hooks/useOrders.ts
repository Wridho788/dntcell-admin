/**
 * React Query Hooks for Orders
 * Provides query and mutation hooks for order operations
 */

'use client';

import { useQuery, useMutation, useQueryClient, UseQueryOptions, UseMutationOptions } from '@tanstack/react-query';
import { 
  orderService, 
  type OrderWithRelations, 
  type OrderFilters, 
  type CreateOrderPayload, 
  type UpdateOrderStatusPayload,
  type Order
} from '@/lib/services';

// Query keys
export const orderKeys = {
  all: ['orders'] as const,
  lists: () => [...orderKeys.all, 'list'] as const,
  list: (filters?: OrderFilters) => [...orderKeys.lists(), { filters }] as const,
  details: () => [...orderKeys.all, 'detail'] as const,
  detail: (id: string) => [...orderKeys.details(), id] as const,
};

/**
 * Hook to fetch list of orders with filters
 */
export function useOrders(
  filters?: OrderFilters,
  options?: Omit<UseQueryOptions<OrderWithRelations[], Error>, 'queryKey' | 'queryFn'>
) {
  return useQuery<OrderWithRelations[], Error>({
    queryKey: orderKeys.list(filters),
    queryFn: async () => {
      const response = await orderService.getOrders(filters);
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to fetch orders');
      }
      return response.data;
    },
    ...options,
  });
}

/**
 * Hook to fetch single order by ID
 */
export function useOrder(
  id: string,
  options?: Omit<UseQueryOptions<OrderWithRelations, Error>, 'queryKey' | 'queryFn'>
) {
  return useQuery<OrderWithRelations, Error>({
    queryKey: orderKeys.detail(id),
    queryFn: async () => {
      const response = await orderService.getOrderById(id);
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to fetch order');
      }
      return response.data;
    },
    enabled: !!id,
    ...options,
  });
}

/**
 * Hook to create new order
 */
export function useCreateOrder(
  options?: UseMutationOptions<Order, Error, CreateOrderPayload>
) {
  const queryClient = useQueryClient();

  return useMutation<Order, Error, CreateOrderPayload>({
    mutationFn: async (payload) => {
      const response = await orderService.createOrder(payload);
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to create order');
      }
      return response.data;
    },
    onSuccess: (data) => {
      // Invalidate orders list
      queryClient.invalidateQueries({ queryKey: orderKeys.lists() });
    },
    ...options,
  });
}

/**
 * Hook to update order status (admin only)
 */
export function useUpdateOrderStatus(
  options?: UseMutationOptions<Order, Error, { id: string; payload: UpdateOrderStatusPayload }>
) {
  const queryClient = useQueryClient();

  return useMutation<Order, Error, { id: string; payload: UpdateOrderStatusPayload }>({
    mutationFn: async ({ id, payload }) => {
      const response = await orderService.updateOrderStatus(id, payload);
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to update order status');
      }
      return response.data;
    },
    onSuccess: (data, variables) => {
      // Invalidate lists
      queryClient.invalidateQueries({ queryKey: orderKeys.lists() });
      // Invalidate specific order detail
      queryClient.invalidateQueries({ queryKey: orderKeys.detail(variables.id) });
    },
    ...options,
  });
}
