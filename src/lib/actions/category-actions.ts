'use server'

import { createServerSupabaseClient, getCurrentUser, isUserAdmin } from '@/lib/supabase/server'
import { z } from 'zod'
import { slugify } from '@/lib/utils/slugify'

// Category type matching database structure
export interface Category {
  id: string
  name: string
  slug: string
  created_at: string
}

// Get all categories
export async function getCategories(): Promise<{ success: boolean; data?: Category[]; error?: string }> {
  try {
    // Verify user is authenticated (optional: you can make this public if needed)
    const user = await getCurrentUser()
    if (!user) {
      throw new Error('Authentication required')
    }

    const supabase = await createServerSupabaseClient()
    
    const { data, error } = await supabase
      .from('categories')
      .select('id, name, slug, created_at')
      .order('name', { ascending: true })

    if (error) {
      console.error('Database error:', error)
      // Handle missing categories table
      if (error.code === '42P01' || error.message.includes('relation') || error.message.includes('does not exist') || error.message.includes('Invalid Relationships')) {
        return {
          success: true,
          data: [] // Return empty array for missing table
        }
      }
      return {
        success: false,
        error: 'Failed to fetch categories'
      }
    }

    return {
      success: true,
      data: (data || []) as unknown as Category[]
    }
  } catch (error) {
    console.error('Get categories error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'An unexpected error occurred'
    }
  }
}

// Get category by ID
export async function getCategoryById(id: string): Promise<{ success: boolean; data?: Category; error?: string }> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      throw new Error('Authentication required')
    }

    const supabase = await createServerSupabaseClient()
    
    const { data, error } = await supabase
      .from('categories')
      .select('id, name, slug, created_at')
      .eq('id', id)
      .single()

    if (error) {
      console.error('Database error:', error)
      // Handle missing categories table
      if (error.code === '42P01' || error.message.includes('relation') || error.message.includes('does not exist') || error.message.includes('Invalid Relationships')) {
        return {
          success: false,
          error: 'Category not found (categories table not configured)'
        }
      }
      return {
        success: false,
        error: 'Failed to fetch category'
      }
    }

    return {
      success: true,
      data: data as unknown as Category
    }
  } catch (error) {
    console.error('Get category error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'An unexpected error occurred'
    }
  }
}

// Create category (admin only) - slug auto-generated
export async function createCategory(data: { name: string }): Promise<{ success: boolean; data?: Category; error?: string }> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return {
        success: false,
        error: 'Authentication required'
      }
    }

    const hasAdminAccess = await isUserAdmin(user.id)
    if (!hasAdminAccess) {
      return {
        success: false,
        error: 'Admin access required'
      }
    }

    // Auto-generate slug from name
    const slug = slugify(data.name)

    const supabase = await createServerSupabaseClient()
    
    const { data: category, error } = await supabase
      .from('categories')
      .insert({
        name: data.name,
        slug: slug,
        created_at: new Date().toISOString()
      })
      .select()
      .single()

    if (error) {
      console.error('Database error:', error)
      return {
        success: false,
        error: 'Failed to create category'
      }
    }

    return {
      success: true,
      data: category as unknown as Category
    }
  } catch (error) {
    console.error('Create category error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'An unexpected error occurred'
    }
  }
}

// Update category (admin only) - slug auto-regenerated if name changes
export async function updateCategory(id: string, data: { name?: string }): Promise<{ success: boolean; data?: Category; error?: string }> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return {
        success: false,
        error: 'Authentication required'
      }
    }

    const hasAdminAccess = await isUserAdmin(user.id)
    if (!hasAdminAccess) {
      return {
        success: false,
        error: 'Admin access required'
      }
    }

    const supabase = await createServerSupabaseClient()

    // Build update data
    const updateData: any = {}
    if (data.name) {
      updateData.name = data.name
      updateData.slug = slugify(data.name) // Regenerate slug if name changes
    }

    if (Object.keys(updateData).length === 0) {
      return {
        success: false,
        error: 'No data to update'
      }
    }
    
    const { data: category, error } = await supabase
      .from('categories')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Database error:', error)
      return {
        success: false,
        error: 'Failed to update category'
      }
    }

    return {
      success: true,
      data: category as unknown as Category
    }
  } catch (error) {
    console.error('Update category error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'An unexpected error occurred'
    }
  }
}

// Delete category (admin only) - with protection check
export async function deleteCategory(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return {
        success: false,
        error: 'Authentication required'
      }
    }

    const hasAdminAccess = await isUserAdmin(user.id)
    if (!hasAdminAccess) {
      return {
        success: false,
        error: 'Admin access required'
      }
    }

    const supabase = await createServerSupabaseClient()

    // Check if category is used by products
    const { count, error: countError } = await supabase
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('category_id', id)

    if (countError) {
      console.error('Error checking category usage:', countError)
      return {
        success: false,
        error: 'Failed to check category usage'
      }
    }

    if ((count ?? 0) > 0) {
      return {
        success: false,
        error: 'Category cannot be deleted because it is used by products'
      }
    }
    
    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Database error:', error)
      return {
        success: false,
        error: 'Failed to delete category'
      }
    }

    return {
      success: true
    }
  } catch (error) {
    console.error('Delete category error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'An unexpected error occurred'
    }
  }
}