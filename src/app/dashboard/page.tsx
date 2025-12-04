import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getCurrentUser, isUserAdmin } from '@/lib/supabase/server'
import { DashboardClient } from './dashboard-client'

export const metadata: Metadata = {
  title: 'Dashboard',
  description: 'Admin dashboard overview',
}

export default async function DashboardPage() {
  // Server-side authentication and role checking
  const user = await getCurrentUser()
  
  if (!user) {
    redirect('/login')
  }

  const hasAdminAccess = await isUserAdmin(user.id)
  
  if (!hasAdminAccess) {
    redirect('/unauthorized')
  }

  // Pass server-side validation, render client component
  return <DashboardClient />
}