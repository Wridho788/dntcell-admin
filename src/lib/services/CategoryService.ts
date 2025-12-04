'use client'

import { createClient } from '@/lib/supabase/client'
import type { ProductCategory } from '@/lib/validations/product'

export interface DbCategory {
  id: string
  name: string
  description?: string | null
  is_active: boolean
  created_at: string
  updated_at?: string
}

export interface CreateCategoryInput {
  name: string
  description?: string
}

export interface UpdateCategoryInput {
  name?: string
  description?: string
  is_active?: boolean
}

export class CategoryService {
  private supabase = createClient()

  // Get all categories
  async getCategories(includeInactive: boolean = false): Promise<{ success: boolean; data?: DbCategory[]; error?: string }> {
    try {
      let queryBuilder = this.supabase
        .from('categories')
        .select('*')
        .order('name', { ascending: true })

      // if (!includeInactive) {
      //   queryBuilder = queryBuilder.eq('is_active', true)
      // }

      const { data, error } = await queryBuilder

      if (error) {
        console.error('Error fetching categories:', error)
        // If table doesn't exist, return mock data
        if (error.code === '42P01' || error.message.includes('relation') || error.message.includes('does not exist')) {
          return this.getMockCategories()
        }
        return { success: false, error: error.message }
      }

      // Check if data is valid before casting
      if (!Array.isArray(data)) {
        console.warn('Invalid data structure from categories table, using mock data')
        return this.getMockCategories()
      }

      // Safe type conversion through unknown
      const categories = data as unknown as DbCategory[]
      return { success: true, data: categories }
    } catch (error) {
      console.error('CategoryService.getCategories error:', error)
      return this.getMockCategories()
    }
  }

  // Helper method to get mock categories
  private getMockCategories(): { success: boolean; data: DbCategory[] } {
    const mockCategories: DbCategory[] = [
      {
        id: '1',
        name: 'Smartphones',
        description: 'Mobile phones and accessories',
        is_active: true,
        created_at: new Date().toISOString()
      },
      {
        id: '2', 
        name: 'Tablets',
        description: 'Tablets and e-readers',
        is_active: true,
        created_at: new Date().toISOString()
      },
      {
        id: '3',
        name: 'Laptops',
        description: 'Laptops and notebooks', 
        is_active: true,
        created_at: new Date().toISOString()
      }
    ]
    return { success: true, data: mockCategories }
  }

  // Get single category by ID
  async getCategoryById(id: string): Promise<{ success: boolean; data?: DbCategory; error?: string }> {
    try {
      if (!id) {
        return { success: false, error: 'Category ID is required' }
      }

      const { data, error } = await this.supabase
        .from('categories')
        .select('*')
        .eq('id', id)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          return { success: false, error: 'Category not found' }
        }
        if (error.code === '42P01' || error.message.includes('relation') || error.message.includes('does not exist')) {
          // Return mock category if table doesn't exist
          const mockCategories = this.getMockCategories()
          const mockCategory = mockCategories.data?.find(cat => cat.id === id)
          if (mockCategory) {
            return { success: true, data: mockCategory }
          }
        }
        console.error('Error fetching category:', error)
        return { success: false, error: error.message }
      }

      if (!data || typeof data !== 'object') {
        return { success: false, error: 'Invalid category data' }
      }

      return { success: true, data: data as unknown as DbCategory }
    } catch (error) {
      console.error('CategoryService.getCategoryById error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }
    }
  }

  // Create new category
  async createCategory(categoryData: CreateCategoryInput): Promise<{ success: boolean; data?: DbCategory; error?: string }> {
    try {
      if (!categoryData.name?.trim()) {
        return { success: false, error: 'Category name is required' }
      }

      const dbData = {
        name: categoryData.name.trim(),
        description: categoryData.description?.trim() || null,
        is_active: true,
        created_at: new Date().toISOString(),
      }

      const { data, error } = await this.supabase
        .from('categories')
        .insert(dbData)
        .select()
        .single()

      if (error) {
        console.error('Error creating category:', error)
        if (error.code === '23505') {
          return { success: false, error: 'Category name already exists' }
        }
        return { success: false, error: error.message }
      }

      return { success: true, data: data as unknown as DbCategory }
    } catch (error) {
      console.error('CategoryService.updateCategory error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Category creation not available (table not configured)'
      }
    }
  }

  // Update category
  async updateCategory(id: string, categoryData: UpdateCategoryInput): Promise<{ success: boolean; data?: DbCategory; error?: string }> {
    try {
      if (!id) {
        return { success: false, error: 'Category ID is required' }
      }

      const updateData: Partial<DbCategory> = {
        updated_at: new Date().toISOString()
      }
      
      if (categoryData.name !== undefined) {
        if (!categoryData.name.trim()) {
          return { success: false, error: 'Category name cannot be empty' }
        }
        updateData.name = categoryData.name.trim()
      }
      
      if (categoryData.description !== undefined) {
        updateData.description = categoryData.description?.trim() || null
      }
      
      if (categoryData.is_active !== undefined) {
        updateData.is_active = categoryData.is_active
      }

      const { data, error } = await this.supabase
        .from('categories')
        .update(updateData)
        .eq('id', id)
        .select()
        .single()

      if (error) {
        console.error('Error updating category:', error)
        if (error.code === '23505') {
          return { success: false, error: 'Category name already exists' }
        }
        return { success: false, error: error.message }
      }

      return { success: true, data: data as unknown as DbCategory }
    } catch (error) {
      console.error('CategoryService.updateCategory error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Category update not available (table not configured)'
      }
    }
  }

  // Soft delete category
  async deleteCategory(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (!id) {
        return { success: false, error: 'Category ID is required' }
      }

      // Check if category is being used by any products
      const { data: products, error: checkError } = await this.supabase
        .from('profiles')
        .select('id')
        .eq('category_id', id)
        .limit(1)

      if (checkError) {
        console.error('Error checking category usage:', checkError)
        return { success: false, error: 'Failed to check category usage' }
      }

      if (products && products.length > 0) {
        return { success: false, error: 'Cannot delete category that is being used by products' }
      }

      // Soft delete by setting is_active to false
      const { error } = await this.supabase
        .from('categories')
        .update({ 
          is_active: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)

      if (error) {
        console.error('Error deleting category:', error)
        return { success: false, error: error.message }
      }

      return { success: true }
    } catch (error) {
      console.error('CategoryService.deleteCategory error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }
    }
  }

  // Get categories with product count
  async getCategoriesWithProductCount(): Promise<{ success: boolean; data?: Array<DbCategory & { product_count: number }>; error?: string }> {
    try {
      // First get all categories
      const { data: categories, error: categoryError } = await this.supabase
        .from('categories')
        .select('*')
        .eq('is_active', true)
        .order('name', { ascending: true })

      if (categoryError) {
        console.error('Error fetching categories:', categoryError)
        if (categoryError.code === '42P01' || categoryError.message.includes('relation') || categoryError.message.includes('does not exist')) {
          // Return mock categories with zero counts
          const mockResult = this.getMockCategories()
          const mockWithCounts = mockResult.data?.map(cat => ({ ...cat, product_count: 0 })) || []
          return { success: true, data: mockWithCounts }
        }
        return { success: false, error: categoryError.message }
      }

      if (!Array.isArray(categories)) {
        const mockResult = this.getMockCategories()
        const mockWithCounts = mockResult.data?.map(cat => ({ ...cat, product_count: 0 })) || []
        return { success: true, data: mockWithCounts }
      }

      // Then get product counts for each category
      const categoriesWithCount = await Promise.all(
        categories.map(async (category: any) => {
          const { count, error: countError } = await this.supabase
            .from('profiles')
            .select('id', { count: 'exact' })
            .eq('category_id', category.id)
            .eq('is_active', true)

          if (countError) {
            console.error(`Error counting products for category ${category.id}:`, countError)
            return { ...category, product_count: 0 }
          }

          return { ...category, product_count: count || 0 }
        })
      )

      return { success: true, data: categoriesWithCount }
    } catch (error) {
      console.error('CategoryService.getCategoriesWithProductCount error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }
    }
  }

  // Restore category (set is_active to true)
  async restoreCategory(id: string): Promise<{ success: boolean; data?: DbCategory; error?: string }> {
    try {
      if (!id) {
        return { success: false, error: 'Category ID is required' }
      }

      const { data, error } = await this.supabase
        .from('categories')
        .update({ 
          is_active: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single()

      if (error) {
        console.error('Error restoring category:', error)
        return { success: false, error: error.message }
      }

      return { success: true, data: data as unknown as DbCategory }
    } catch (error) {
      console.error('CategoryService.restoreCategory error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Category restore not available (table not configured)'
      }
    }
  }
}

// Export singleton instance
export const categoryService = new CategoryService()
export default CategoryService