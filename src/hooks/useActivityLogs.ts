/**
 * React Query Hooks for Activity Logs
 * Provides query hooks for activity log operations
 */

'use client';

import { useQuery, UseQueryOptions } from '@tanstack/react-query';
import { 
  activityLogService, 
  type ActivityLogWithAdmin, 
  type ActivityLogFilters 
} from '@/lib/services';

// Query keys
export const activityLogKeys = {
  all: ['activity-logs'] as const,
  lists: () => [...activityLogKeys.all, 'list'] as const,
  list: (filters?: ActivityLogFilters) => [...activityLogKeys.lists(), { filters }] as const,
};

/**
 * Hook to fetch list of activity logs (admin only)
 */
export function useActivityLogs(
  filters?: ActivityLogFilters,
  options?: Omit<UseQueryOptions<ActivityLogWithAdmin[], Error>, 'queryKey' | 'queryFn'>
) {
  return useQuery<ActivityLogWithAdmin[], Error>({
    queryKey: activityLogKeys.list(filters),
    queryFn: async () => {
      const response = await activityLogService.getActivityLogs(filters);
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to fetch activity logs');
      }
      return response.data;
    },
    ...options,
  });
}
