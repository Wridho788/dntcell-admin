'use client'

import { useQuery } from '@tanstack/react-query'
import { categoryService } from '@/lib/services'

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const result = await categoryService.getCategories()
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch categories')
      }
      return result.data || []
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  })
}

export type { DbCategory as Category } from '@/lib/services'