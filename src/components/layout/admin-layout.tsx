'use client'

import { ReactNode, useEffect, useState } from 'react'
import { AuthWrapper } from '@/components/auth'
import { Navigation } from './navigation'
import { Header } from './header'
import { useOneSignalSync } from '@/hooks/use-onesignal-sync'
import { OneSignalClient } from '@/components/onesignal/onesignal-client'
import { createClient } from '@/lib/supabase/client'

interface AdminLayoutProps {
  children: ReactNode
  requireAuth?: boolean
}

export function AdminLayout({ children, requireAuth = true }: AdminLayoutProps) {
  const [adminId, setAdminId] = useState<string | undefined>()
  
  // Get current user ID for OneSignal
  useEffect(() => {
    const getUser = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setAdminId(user.id)
      }
    }
    getUser()
  }, [])
  
  // Sync OneSignal player ID when user is authenticated
  useOneSignalSync()
  
  const content = (
    <div className="min-h-screen bg-background">
      {/* OneSignal Client Initialization */}
      <OneSignalClient adminId={adminId} />
      
      {/* Header */}
      <Header />
      
      <div className="flex flex-col md:flex-row">
        {/* Sidebar Navigation */}
        <Navigation />
        
        {/* Main Content */}
        <main className="flex-1 overflow-auto w-full">
          {children}
        </main>
      </div>
    </div>
  )

  if (!requireAuth) {
    return content
  }

  return (
    <AuthWrapper requireAdmin={true}>
      {content}
    </AuthWrapper>
  )
}