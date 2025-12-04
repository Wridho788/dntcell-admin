'use server'

import { createServerSupabaseClient, getCurrentUser, isUserAdmin } from '@/lib/supabase/server'

// Location type (assuming similar structure to categories)
export interface Location {
  id: string
  name: string
  slug: string
  created_at: string
}

// Get all locations
export async function getLocations(): Promise<{ success: boolean; data?: Location[]; error?: string }> {
  try {
    // Verify user is authenticated
    const user = await getCurrentUser()
    if (!user) {
      throw new Error('Authentication required')
    }

    const supabase = await createServerSupabaseClient()
    
    const { data, error } = await supabase
      .from('locations')
      .select('id, name, slug, created_at')
      .order('name', { ascending: true })

    if (error) {
      console.error('Database error:', error)
      // Handle missing locations table
      if (error.code === '42P01' || error.message.includes('relation') || error.message.includes('does not exist') || error.message.includes('Invalid Relationships')) {
        return {
          success: true,
          data: [] // Return empty array for missing table
        }
      }
      return {
        success: false,
        error: 'Failed to fetch locations'
      }
    }

    return {
      success: true,
      data: (data || []) as unknown as Location[]
    }
  } catch (error) {
    console.error('Get locations error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'An unexpected error occurred'
    }
  }
}

// Get location by ID
export async function getLocationById(id: string): Promise<{ success: boolean; data?: Location; error?: string }> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      throw new Error('Authentication required')
    }

    const supabase = await createServerSupabaseClient()
    
    const { data, error } = await supabase
      .from('locations')
      .select('id, name, slug, created_at')
      .eq('id', id)
      .single()

    if (error) {
      console.error('Database error:', error)
      // Handle missing locations table
      if (error.code === '42P01' || error.message.includes('relation') || error.message.includes('does not exist') || error.message.includes('Invalid Relationships')) {
        return {
          success: false,
          error: 'Location not found (locations table not configured)'
        }
      }
      return {
        success: false,
        error: 'Failed to fetch location'
      }
    }

    return {
      success: true,
      data: data as unknown as Location
    }
  } catch (error) {
    console.error('Get location error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'An unexpected error occurred'
    }
  }
}

// Create location (admin only)
export async function createLocation(data: { name: string; slug: string }): Promise<{ success: boolean; data?: Location; error?: string }> {
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
    
    const { data: location, error } = await supabase
      .from('locations')
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
        error: 'Failed to create location'
      }
    }

    return {
      success: true,
      data: location as unknown as Location
    }
  } catch (error) {
    console.error('Create location error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'An unexpected error occurred'
    }
  }
}