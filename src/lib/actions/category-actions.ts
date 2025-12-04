'use server'

import { createServerSupabaseClient, getCurrentUser, isUserAdmin } from '@/lib/supabase/server'
import { z } from 'zod'

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

// Create category (admin only)
export async function createCategory(data: { name: string; slug: string }): Promise<{ success: boolean; data?: Category; error?: string }> {
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
    
    const { data: category, error } = await supabase
      .from('categories')
      .insert({
        name: data.name,
        slug: data.slug,
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