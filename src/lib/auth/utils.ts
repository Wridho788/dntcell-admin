import { createClient } from '@/lib/supabase/client'

/**
 * Logout user by clearing session and redirecting
 */
export async function logout(): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.auth.signOut()
  
  if (error) {
    throw new Error(error.message)
  }
  
  // Clear any local storage or cached data if needed
  if (typeof window !== 'undefined') {
    // Clear theme preference or other cached data if needed
    // Note: Supabase automatically handles auth token cleanup
    window.location.href = '/login'
  }
}

/**
 * Check if user has admin role
 */
export async function checkAdminAccess(): Promise<boolean> {
  const supabase = createClient()
  
  try {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return false
    }

    // Check user role from user metadata or profiles table
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    return (profile as any)?.role === 'admin'
  } catch (error) {
    console.error('Error checking admin access:', error)
    return false
  }
}

/**
 * Get current user session
 */
export async function getCurrentSession() {
  const supabase = createClient()
  
  try {
    const { data: { session } } = await supabase.auth.getSession()
    return session
  } catch (error) {
    console.error('Error getting session:', error)
    return null
  }
}

/**
 * Get current user
 */
export async function getCurrentUser() {
  const supabase = createClient()
  
  try {
    const { data: { user } } = await supabase.auth.getUser()
    return user
  } catch (error) {
    console.error('Error getting user:', error)
    return null
  }
}
