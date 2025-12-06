import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getCurrentUser, isUserAdmin } from '@/lib/supabase/server'
import { ProductForm } from '@/components/products/product-form'
import { AdminLayout } from '@/components/layout'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Create Product',
  description: 'Create a new product in your catalog',
}

export default async function NewProductPage() {
  // Server-side authentication check
  const user = await getCurrentUser()
  if (!user) {
    redirect('/login')
  }

  const hasAdminAccess = await isUserAdmin(user.id)
  if (!hasAdminAccess) {
    redirect('/unauthorized')
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Create Product</h1>
          <p className="text-muted-foreground">
            Add a new product to your catalog
          </p>
        </div>
        
        <ProductForm mode="create" />
      </div>
    </AdminLayout>
  )
}