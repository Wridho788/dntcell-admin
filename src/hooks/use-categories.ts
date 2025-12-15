'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { categoryService } from '@/lib/services'
import { toast } from 'sonner'

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

export function useCreateCategory() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: { name: string }) => {
      const result = await categoryService.createCategory(data)
      if (!result.success) {
        throw new Error(result.error || 'Failed to create category')
      }
      return result.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      toast.success('Category created successfully')
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })
}

export function useUpdateCategory() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { name?: string } }) => {
      const result = await categoryService.updateCategory(id, data)
      if (!result.success) {
        throw new Error(result.error || 'Failed to update category')
      }
      return result.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      toast.success('Category updated successfully')
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })
}

export function useDeleteCategory() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const result = await categoryService.deleteCategory(id)
      if (!result.success) {
        throw new Error(result.error || 'Failed to delete category')
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      toast.success('Category deleted successfully')
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })
}

export type { DbCategory as Category } from '@/lib/services'