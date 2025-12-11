/**
 * React Query Hooks for Notifications
 * Provides query and mutation hooks for notification operations
 */

'use client';

import { useQuery, useMutation, useQueryClient, UseQueryOptions, UseMutationOptions } from '@tanstack/react-query';
import { 
  notificationService, 
  type Notification, 
  type NotificationFilters, 
  type CreateNotificationPayload 
} from '@/lib/services';

// Query keys
export const notificationKeys = {
  all: ['notifications'] as const,
  lists: () => [...notificationKeys.all, 'list'] as const,
  list: (filters?: NotificationFilters) => [...notificationKeys.lists(), { filters }] as const,
};

/**
 * Hook to fetch list of notifications with filters
 */
export function useNotifications(
  filters?: NotificationFilters,
  options?: Omit<UseQueryOptions<Notification[], Error>, 'queryKey' | 'queryFn'>
) {
  return useQuery<Notification[], Error>({
    queryKey: notificationKeys.list(filters),
    queryFn: async () => {
      const response = await notificationService.getNotifications(filters);
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to fetch notifications');
      }
      return response.data;
    },
    ...options,
  });
}

/**
 * Hook to send notification (admin only)
 */
export function useSendNotification(
  options?: UseMutationOptions<Notification, Error, CreateNotificationPayload>
) {
  const queryClient = useQueryClient();

  return useMutation<Notification, Error, CreateNotificationPayload>({
    mutationFn: async (payload) => {
      const response = await notificationService.sendNotification(payload);
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to send notification');
      }
      return response.data;
    },
    onSuccess: (data) => {
      // Invalidate notifications list
      queryClient.invalidateQueries({ queryKey: notificationKeys.lists() });
    },
    ...options,
  });
}
