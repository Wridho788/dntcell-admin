/**
 * React Query Hooks for Product Images
 * Provides query and mutation hooks for product image operations
 */

'use client';

import { useQuery, useMutation, useQueryClient, UseQueryOptions, UseMutationOptions } from '@tanstack/react-query';
import { 
  productImageService, 
  type ProductImage, 
  type CreateProductImagePayload, 
  type UpdateProductImagePayload 
} from '@/lib/services';

// Query keys
export const productImageKeys = {
  all: ['product-images'] as const,
  lists: () => [...productImageKeys.all, 'list'] as const,
  list: (product_id: string) => [...productImageKeys.lists(), { product_id }] as const,
  details: () => [...productImageKeys.all, 'detail'] as const,
  detail: (id: string) => [...productImageKeys.details(), id] as const,
};

/**
 * Hook to fetch list of images for a product
 */
export function useProductImages(
  product_id: string,
  options?: Omit<UseQueryOptions<ProductImage[], Error>, 'queryKey' | 'queryFn'>
) {
  return useQuery<ProductImage[], Error>({
    queryKey: productImageKeys.list(product_id),
    queryFn: async () => {
      const response = await productImageService.getProductImages(product_id);
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to fetch product images');
      }
      return response.data;
    },
    enabled: !!product_id,
    ...options,
  });
}

/**
 * Hook to fetch single product image by ID
 */
export function useProductImage(
  id: string,
  options?: Omit<UseQueryOptions<ProductImage, Error>, 'queryKey' | 'queryFn'>
) {
  return useQuery<ProductImage, Error>({
    queryKey: productImageKeys.detail(id),
    queryFn: async () => {
      const response = await productImageService.getProductImageById(id);
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to fetch product image');
      }
      return response.data;
    },
    enabled: !!id,
    ...options,
  });
}

/**
 * Hook to create new product image
 */
export function useCreateProductImage(
  options?: UseMutationOptions<ProductImage, Error, CreateProductImagePayload>
) {
  const queryClient = useQueryClient();

  return useMutation<ProductImage, Error, CreateProductImagePayload>({
    mutationFn: async (payload) => {
      const response = await productImageService.createProductImage(payload);
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to create product image');
      }
      return response.data;
    },
    onSuccess: (data, variables) => {
      // Invalidate product images list for this product
      queryClient.invalidateQueries({ queryKey: productImageKeys.list(variables.product_id) });
    },
    ...options,
  });
}

/**
 * Hook to update product image
 */
export function useUpdateProductImage(
  options?: UseMutationOptions<ProductImage, Error, { id: string; payload: UpdateProductImagePayload }>
) {
  const queryClient = useQueryClient();

  return useMutation<ProductImage, Error, { id: string; payload: UpdateProductImagePayload }>({
    mutationFn: async ({ id, payload }) => {
      const response = await productImageService.updateProductImage(id, payload);
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to update product image');
      }
      return response.data;
    },
    onSuccess: (data, variables) => {
      // Invalidate product images list (includes all products since we don't have product_id here)
      queryClient.invalidateQueries({ queryKey: productImageKeys.lists() });
      // Invalidate specific image detail
      queryClient.invalidateQueries({ queryKey: productImageKeys.detail(variables.id) });
    },
    ...options,
  });
}

/**
 * Hook to delete product image
 */
export function useDeleteProductImage(
  options?: UseMutationOptions<void, Error, string>
) {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: async (id) => {
      const response = await productImageService.deleteProductImage(id);
      if (!response.success) {
        throw new Error(response.error || 'Failed to delete product image');
      }
    },
    onSuccess: (data, id) => {
      // Invalidate all product images lists
      queryClient.invalidateQueries({ queryKey: productImageKeys.lists() });
      // Remove specific image from cache
      queryClient.removeQueries({ queryKey: productImageKeys.detail(id) });
    },
    ...options,
  });
}
