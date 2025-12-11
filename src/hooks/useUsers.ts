/**
 * React Query Hooks for Users
 * Provides query hooks for user operations
 */

'use client';

import { useQuery, UseQueryOptions } from '@tanstack/react-query';
import { 
  userService, 
  type User, 
  type UserFilters, 
  type CurrentUserProfile 
} from '@/lib/services';

// Query keys
export const userKeys = {
  all: ['users'] as const,
  lists: () => [...userKeys.all, 'list'] as const,
  list: (filters?: UserFilters) => [...userKeys.lists(), { filters }] as const,
  currentUser: () => [...userKeys.all, 'current'] as const,
};

/**
 * Hook to fetch list of users (admin only)
 */
export function useUsers(
  filters?: UserFilters,
  options?: Omit<UseQueryOptions<User[], Error>, 'queryKey' | 'queryFn'>
) {
  return useQuery<User[], Error>({
    queryKey: userKeys.list(filters),
    queryFn: async () => {
      const response = await userService.getUsers(filters);
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to fetch users');
      }
      return response.data;
    },
    ...options,
  });
}

/**
 * Hook to fetch current user profile
 */
export function useCurrentUser(
  options?: Omit<UseQueryOptions<CurrentUserProfile, Error>, 'queryKey' | 'queryFn'>
) {
  return useQuery<CurrentUserProfile, Error>({
    queryKey: userKeys.currentUser(),
    queryFn: async () => {
      const response = await userService.getCurrentUser();
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to fetch current user');
      }
      return response.data;
    },
    ...options,
  });
}
