'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'

// Cache for admin status to reduce database calls
const adminCache = new Map<string, { isAdmin: boolean; timestamp: number }>()
const CACHE_DURATION = 60000 // 1 minute

// Hook for getting current user in client components
export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    // Safety timeout: force loading to false after 10 seconds to prevent infinite loading
    const timeout = setTimeout(() => {
      if (loading) {
        console.warn('[useAuth] Loading timeout - forcing loading to false')
        setLoading(false)
      }
    }, 10000)

    // Get initial session
    const getInitialSession = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        
        if (sessionError) {
          console.error('[useAuth] Session error:', sessionError)
          setLoading(false)
          return
        }
        
        setUser(session?.user ?? null)
        
        if (session?.user) {
          // Check cache first
          const cached = adminCache.get(session.user.id)
          const now = Date.now()
          
          if (cached && (now - cached.timestamp) < CACHE_DURATION) {
            setIsAdmin(cached.isAdmin)
            setLoading(false)
            return
          }
          
          // Check admin status from database
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('role')
            .eq('user_id', session.user.id)
            .maybeSingle()
          
          if (profileError) {
            console.error('[useAuth] Profile fetch error:', profileError)
            setIsAdmin(false)
            setLoading(false)
            return
          }
          
          const adminStatus = profile?.role === 'admin' || profile?.role === 'super_admin'
          setIsAdmin(adminStatus)
          
          // Update cache
          adminCache.set(session.user.id, { isAdmin: adminStatus, timestamp: now })
        }
        
        setLoading(false)
      } catch (error) {
        console.error('[useAuth] Unexpected error:', error)
        setLoading(false)
      }
    }

    getInitialSession()

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event: any, session: any) => {
      try {
        setUser(session?.user ?? null)
        
        if (session?.user) {
          // Check cache first
          const cached = adminCache.get(session.user.id)
          const now = Date.now()
          
          if (cached && (now - cached.timestamp) < CACHE_DURATION) {
            setIsAdmin(cached.isAdmin)
          } else {
            // Check admin status from database
            const { data: profile, error: profileError } = await supabase
              .from('profiles')
              .select('role')
              .eq('user_id', session.user.id)
              .maybeSingle()
            
            if (profileError) {
              console.error('[useAuth] Profile fetch error on auth change:', profileError)
              setIsAdmin(false)
            } else {
              const adminStatus = profile?.role === 'admin' || profile?.role === 'super_admin'
              setIsAdmin(adminStatus)
              
              // Update cache
              adminCache.set(session.user.id, { isAdmin: adminStatus, timestamp: now })
            }
          }
        } else {
          setIsAdmin(false)
        }
        
        setLoading(false)
      } catch (error) {
        console.error('[useAuth] Error in auth state change:', error)
        setLoading(false)
      }
    })

    return () => {
      clearTimeout(timeout)
      subscription.unsubscribe()
    }
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