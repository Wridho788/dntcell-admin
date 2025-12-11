/**
 * Product Image Service
 * Handles all product image-related API operations
 */

import { api } from '../api-client';

export interface ProductImage {
  id: string;
  product_id: string;
  image_url: string;
  display_order: number;
  is_main: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateProductImagePayload {
  product_id: string;
  image_url: string;
  display_order?: number;
  is_main?: boolean;
}

export interface UpdateProductImagePayload {
  display_order?: number;
  is_main?: boolean;
}

export const productImageService = {
  /**
   * Get list of images for a product
   */
  async getProductImages(product_id: string) {
    return api.get<ProductImage[]>('/product-images', { product_id });
  },

  /**
   * Get single product image by ID
   */
  async getProductImageById(id: string) {
    return api.get<ProductImage>(`/product-images/${id}`);
  },

  /**
   * Upload and create new product image
   */
  async createProductImage(payload: CreateProductImagePayload) {
    return api.post<ProductImage>('/product-images', payload);
  },

  /**
   * Update product image (display order or main status)
   */
  async updateProductImage(id: string, payload: UpdateProductImagePayload) {
    return api.patch<ProductImage>(`/product-images/${id}`, payload);
  },

  /**
   * Delete product image
   */
  async deleteProductImage(id: string) {
    return api.delete<void>(`/product-images/${id}`);
  },
};
