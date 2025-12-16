import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/supabase/server'
import { NotificationsClient } from './notifications-client'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Notifications',
  description: 'View and manage your notifications',
}

export default async function NotificationsPage() {
  const user = await getCurrentUser()
  if (!user) {
    redirect('/login')
  }

  return <NotificationsClient />
}
