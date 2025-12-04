'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'

// Hook for getting current user in client components
export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setUser(session?.user ?? null)
      
      if (session?.user) {
        // Check admin status
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('user_id', session.user.id)
          .maybeSingle()
        
        setIsAdmin(profile?.role === 'admin' || profile?.role === 'super_admin')
      }
      
      setLoading(false)
    }

    getInitialSession()

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event: any, session: any) => {
      setUser(session?.user ?? null)
      
      if (session?.user) {
        // Check admin status
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('user_id', session.user.id)
          .maybeSingle()
        
        setIsAdmin(profile?.role === 'admin' || profile?.role === 'super_admin')
      } else {
        setIsAdmin(false)
      }
      
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  return { user, loading, isAdmin }
}

// Hook for requiring authentication
export function useRequireAuth() {
  const { user, loading, isAdmin } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
    }
  }, [user, loading, router])

  return { user, loading, isAdmin }
}

// Logout function
export const logout = async () => {
  await supabase.auth.signOut()
}

// Check if user has admin role
export const checkAdminRole = async (userId: string): Promise<boolean> => {
  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', userId)
      .maybeSingle()
    
    if (error || !profile) {
      return false
    }
    
    return profile.role === 'admin' || profile.role === 'super_admin'
  } catch (error) {
    console.error('Error checking admin role:', error)
    return false
  }
}