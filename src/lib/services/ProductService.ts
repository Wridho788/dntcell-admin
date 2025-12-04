// 'use client'

import { createClient } from '@/lib/supabase/client'
import type { Product, ProductSearch, CreateProductInput, UpdateProductInput } from '@/lib/validations/product'
import { createProduct as createProductAction, updateProduct as updateProductAction } from '@/lib/actions/product-actions'

// Type definitions matching the database structure
export interface DbProduct {
  id: string
  name: string
  description: string | null
  category_id: string | null
  base_price: number
  selling_price: number
  negotiable: boolean
  is_active: boolean
  seller_id: string
  condition: string
  status: string
  details: any | null
  reject_note: string | null
  main_image_url: string | null
  created_at: string
}

export interface ProductFilters {
  query?: string
  category_id?: string
  is_active?: boolean
  negotiable?: boolean
  min_price?: number
  max_price?: number
  condition?: string
  status?: string
  page?: number
  limit?: number
  sort_by?: 'name' | 'base_price' | 'selling_price' | 'created_at'
  sort_order?: 'asc' | 'desc'
}

export interface ProductsResponse {
  products: DbProduct[]
  total: number
  totalPages: number
}

export class ProductService {
  private supabase = createClient()

  // Mock products for fallback when database is not configured
  private getMockProductsResponse(filters: ProductFilters = {}): { success: boolean; data: ProductsResponse } {
    const mockProducts: DbProduct[] = [
      {
        id: 'mock-1',
        name: 'iPhone 15 Pro',
        description: 'Latest iPhone with Pro features',
        category_id: 'smartphones',
        base_price: 15000000,
        selling_price: 16000000,
        negotiable: true,
        is_active: true,
        seller_id: '5345f8da-b756-42b7-958e-567f6aa13b1e',
        condition: 'new',
        status: 'active',
        details: { stock: 5 },
        reject_note: null,
        main_image_url: null,
        created_at: new Date().toISOString(),
      },
      {
        id: 'mock-2',
        name: 'Samsung Galaxy S24',
        description: 'Premium Samsung smartphone',
        category_id: 'smartphones',
        base_price: 12000000,
        selling_price: 13500000,
        negotiable: false,
        is_active: true,
        seller_id: 'seller-2',
        condition: 'like_new',
        status: 'active',
        details: { stock: 3 },
        reject_note: null,
        main_image_url: null,
        created_at: new Date().toISOString(),
      },
    ]

    return {
      success: true,
      data: {
        products: mockProducts,
        total: mockProducts.length,
        totalPages: 1,
      },
    }
  }

  // Get products with filtering and pagination
  async getProducts(filters: ProductFilters = {}): Promise<{ success: boolean; data?: ProductsResponse; error?: string }> {
    try {
      const {
        query,
        category_id,
        is_active,
        negotiable,
        min_price,
        max_price,
        condition,
        status,
        page = 1,
        limit = 20,
        sort_by = 'created_at',
        sort_order = 'desc'
      } = filters

      // Changed from 'profiles' to 'products'
      let queryBuilder = this.supabase
        .from('products')
        .select('*', { count: 'exact' })

      // Apply filters
      if (query) {
        queryBuilder = queryBuilder.or(`name.ilike.%${query}%,description.ilike.%${query}%`)
      }

      if (category_id) {
        queryBuilder = queryBuilder.eq('category_id', category_id)
      }

      if (is_active !== undefined) {
        queryBuilder = queryBuilder.eq('is_active', is_active)
      }

      if (negotiable !== undefined) {
        queryBuilder = queryBuilder.eq('negotiable', negotiable)
      }

      if (min_price !== undefined) {
        queryBuilder = queryBuilder.gte('selling_price', min_price)
      }

      if (max_price !== undefined) {
        queryBuilder = queryBuilder.lte('selling_price', max_price)
      }

      if (condition) {
        queryBuilder = queryBuilder.eq('condition', condition)
      }

      if (status) {
        queryBuilder = queryBuilder.eq('status', status)
      }

      // Apply sorting
      queryBuilder = queryBuilder.order(sort_by, { ascending: sort_order === 'asc' })

      // Apply pagination
      const from = (page - 1) * limit
      const to = from + limit - 1
      queryBuilder = queryBuilder.range(from, to)

      const { data, count, error } = await queryBuilder

      if (error) {
        console.error('Error fetching products:', error)
        // If products table doesn't exist or has wrong schema, return mock data
        if (error.code === '42P01' || error.message.includes('relation') || error.message.includes('does not exist') || error.message.includes('Invalid Relationships')) {
          return this.getMockProductsResponse(filters)
        }
        return { success: false, error: error.message }
      }

      // Check if data is valid before using
      if (!Array.isArray(data)) {
        console.warn('Invalid data structure from products table, using mock data')
        return this.getMockProductsResponse(filters)
      }

      const totalPages = Math.ceil((count || 0) / limit)

      return {
        success: true,
        data: {
          products: data as unknown as DbProduct[],
          total: count || 0,
          totalPages,
        },
      }
    } catch (error) {
      console.error('ProductService.getProducts error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }
    }
  }

  // Get single product by ID
  async getProductById(id: string): Promise<{ success: boolean; data?: DbProduct; error?: string }> {
    try {
      if (!id) {
        return { success: false, error: 'Product ID is required' }
      }

      const { data, error } = await this.supabase
        .from('products')
        .select('*')
        .eq('id', id)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          return { success: false, error: 'Product not found' }
        }
        if (error.code === '42P01' || error.message.includes('relation') || error.message.includes('does not exist') || error.message.includes('Invalid Relationships')) {
          // Return mock product if table doesn't exist
          const mockProducts = this.getMockProductsResponse({})
          const mockProduct = mockProducts.data?.products.find(p => p.id === id)
          if (mockProduct) {
            return { success: true, data: mockProduct }
          }
        }
        console.error('Error fetching product:', error)
        return { success: false, error: error.message }
      }

      if (!data || typeof data !== 'object') {
        return { success: false, error: 'Invalid product data' }
      }

      return { success: true, data: data as unknown as DbProduct }
    } catch (error) {
      console.error('ProductService.getProductById error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }
    }
  }

  // Create new product
  async createProduct(productData: CreateProductInput): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      console.log('📞 ProductService.createProduct - Calling server action with:', productData)
      
      // Call server action which handles image moving, etc.
      const result = await createProductAction(productData)
      
      console.log('📥 ProductService.createProduct - Server action result:', result)
      
      return result
    } catch (error) {
      console.error('💥 ProductService.createProduct error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }
    }
  }

  // Update product
  async updateProduct(id: string, productData: UpdateProductInput): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      console.log('📞 ProductService.updateProduct - Calling server action with:', { id, productData })
      
      // Call server action which handles validation, etc.
      // Server action expects id to be part of the data object
      const dataWithId = { ...productData, id }
      const result = await updateProductAction(dataWithId as UpdateProductInput)
      
      console.log('📥 ProductService.updateProduct - Server action result:', result)
      
      return result
    } catch (error) {
      console.error('💥 ProductService.updateProduct error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }
    }
  }

  // Soft delete product
  async deleteProduct(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (!id) {
        return { success: false, error: 'Product ID is required' }
      }

      const { error } = await this.supabase
        .from('products')
        .update({ is_active: false } as any)
        .eq('id', id)

      if (error) {
        console.error('Error deleting product:', error)
        return { success: false, error: error.message }
      }

      return { success: true }
    } catch (error) {
      console.error('ProductService.deleteProduct error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }
    }
  }

  // Bulk actions
  async bulkUpdateStatus(productIds: string[], is_active: boolean): Promise<{ success: boolean; error?: string }> {
    try {
      if (!productIds.length) {
        return { success: false, error: 'No products selected' }
      }

      const { error } = await this.supabase
        .from('products')
        .update({ is_active } as any)
        .in('id', productIds)

      if (error) {
        console.error('Error in bulk update:', error)
        return { success: false, error: error.message }
      }

      return { success: true }
    } catch (error) {
      console.error('ProductService.bulkUpdateStatus error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }
    }
  }

  // Get product statistics
  async getProductStats(): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const { data, error } = await this.supabase
        .from('products')
        .select('is_active, negotiable, selling_price')

      if (error) {
        console.error('Error fetching product stats:', error)
        if (error.code === '42P01' || error.message.includes('relation') || error.message.includes('does not exist') || error.message.includes('Invalid Relationships')) {
          // Return mock stats
          const stats = { total: 0, active: 0, inactive: 0, negotiable: 0, avgPrice: 0 }
          return { success: true, data: stats }
        }
        return { success: false, error: error.message }
      }

      if (!Array.isArray(data)) {
        const stats = { total: 0, active: 0, inactive: 0, negotiable: 0, avgPrice: 0 }
        return { success: true, data: stats }
      }

      const stats = {
        total: data.length,
        active: data.filter((p: any) => p.is_active).length,
        inactive: data.filter((p: any) => !p.is_active).length,
        negotiable: data.filter((p: any) => p.negotiable).length,
        avgPrice: data.length > 0 ? data.reduce((sum: number, p: any) => sum + (p.selling_price || 0), 0) / data.length : 0,
      }

      return { success: true, data: stats }
    } catch (error) {
      console.error('ProductService.getProductStats error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }
    }
  }
}

// Export singleton instance
export const productService = new ProductService()
export default ProductService