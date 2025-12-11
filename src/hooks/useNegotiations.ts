/**
 * React Query Hooks for Negotiations
 * Provides query and mutation hooks for negotiation operations
 */

'use client';

import { useQuery, useMutation, useQueryClient, UseQueryOptions, UseMutationOptions } from '@tanstack/react-query';
import { 
  negotiationService, 
  type NegotiationWithRelations, 
  type NegotiationFilters, 
  type CreateNegotiationPayload, 
  type ApproveNegotiationPayload, 
  type RejectNegotiationPayload,
  type Negotiation
} from '@/lib/services';

// Query keys
export const negotiationKeys = {
  all: ['negotiations'] as const,
  lists: () => [...negotiationKeys.all, 'list'] as const,
  list: (filters?: NegotiationFilters) => [...negotiationKeys.lists(), { filters }] as const,
  details: () => [...negotiationKeys.all, 'detail'] as const,
  detail: (id: string) => [...negotiationKeys.details(), id] as const,
};

/**
 * Hook to fetch list of negotiations with filters
 */
export function useNegotiations(
  filters?: NegotiationFilters,
  options?: Omit<UseQueryOptions<NegotiationWithRelations[], Error>, 'queryKey' | 'queryFn'>
) {
  return useQuery<NegotiationWithRelations[], Error>({
    queryKey: negotiationKeys.list(filters),
    queryFn: async () => {
      const response = await negotiationService.getNegotiations(filters);
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to fetch negotiations');
      }
      return response.data;
    },
    ...options,
  });
}

/**
 * Hook to fetch single negotiation by ID
 */
export function useNegotiation(
  id: string,
  options?: Omit<UseQueryOptions<NegotiationWithRelations, Error>, 'queryKey' | 'queryFn'>
) {
  return useQuery<NegotiationWithRelations, Error>({
    queryKey: negotiationKeys.detail(id),
    queryFn: async () => {
      const response = await negotiationService.getNegotiationById(id);
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to fetch negotiation');
      }
      return response.data;
    },
    enabled: !!id,
    ...options,
  });
}

/**
 * Hook to create new negotiation
 */
export function useCreateNegotiation(
  options?: UseMutationOptions<Negotiation, Error, CreateNegotiationPayload>
) {
  const queryClient = useQueryClient();

  return useMutation<Negotiation, Error, CreateNegotiationPayload>({
    mutationFn: async (payload) => {
      const response = await negotiationService.createNegotiation(payload);
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to create negotiation');
      }
      return response.data;
    },
    onSuccess: (data) => {
      // Invalidate negotiations list
      queryClient.invalidateQueries({ queryKey: negotiationKeys.lists() });
    },
    ...options,
  });
}

/**
 * Hook to approve negotiation (admin only)
 */
export function useApproveNegotiation(
  options?: UseMutationOptions<Negotiation, Error, { id: string; payload: ApproveNegotiationPayload }>
) {
  const queryClient = useQueryClient();

  return useMutation<Negotiation, Error, { id: string; payload: ApproveNegotiationPayload }>({
    mutationFn: async ({ id, payload }) => {
      const response = await negotiationService.approveNegotiation(id, payload);
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to approve negotiation');
      }
      return response.data;
    },
    onSuccess: (data, variables) => {
      // Invalidate lists
      queryClient.invalidateQueries({ queryKey: negotiationKeys.lists() });
      // Invalidate specific negotiation detail
      queryClient.invalidateQueries({ queryKey: negotiationKeys.detail(variables.id) });
    },
    ...options,
  });
}

/**
 * Hook to reject negotiation (admin only)
 */
export function useRejectNegotiation(
  options?: UseMutationOptions<Negotiation, Error, { id: string; payload: RejectNegotiationPayload }>
) {
  const queryClient = useQueryClient();

  return useMutation<Negotiation, Error, { id: string; payload: RejectNegotiationPayload }>({
    mutationFn: async ({ id, payload }) => {
      const response = await negotiationService.rejectNegotiation(id, payload);
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to reject negotiation');
      }
      return response.data;
    },
    onSuccess: (data, variables) => {
      // Invalidate lists
      queryClient.invalidateQueries({ queryKey: negotiationKeys.lists() });
      // Invalidate specific negotiation detail
      queryClient.invalidateQueries({ queryKey: negotiationKeys.detail(variables.id) });
    },
    ...options,
  });
}
