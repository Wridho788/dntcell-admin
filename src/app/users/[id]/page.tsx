import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/supabase/server'
import { UserDetailClient } from './user-detail-client'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'User Detail',
  description: 'View user details and manage permissions',
}

export default async function UserDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const user = await getCurrentUser()
  if (!user) {
    redirect('/login')
  }

  return <UserDetailClient userId={params.id} />
}
