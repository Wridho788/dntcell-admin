'use client'

import { useAuth } from '@/lib/auth/hooks'
import { LoadingScreen } from '@/components/ui/loading'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

interface AuthWrapperProps {
  children: React.ReactNode
  requireAdmin?: boolean
}

export function AuthWrapper({ children, requireAdmin = true }: AuthWrapperProps) {
  const { user, loading, isAdmin } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push('/login')
        return
      }
      
      if (requireAdmin && !isAdmin) {
        router.push('/unauthorized')
        return
      }
    }
  }, [user, loading, isAdmin, requireAdmin, router])

  if (loading) {
    return <LoadingScreen text="Memuat halaman..." />
  }

  if (!user || (requireAdmin && !isAdmin)) {
    return null
  }

  return <>{children}</>
}