'use client'

import { useQuery } from '@tanstack/react-query'
import { getLocations, type Location } from '@/lib/actions/location-actions'

export function useLocations() {
  return useQuery({
    queryKey: ['locations'],
    queryFn: async () => {
      const result = await getLocations()
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch locations')
      }
      return result.data || []
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  })
}

export type { Location }