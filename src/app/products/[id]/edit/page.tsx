import { Metadata } from 'next'
import { redirect, notFound } from 'next/navigation'
import { getCurrentUser, isUserAdmin } from '@/lib/supabase/server'
import { productService } from '@/lib/services'
import { ProductForm } from '@/components/products/product-form'
import { AdminLayout } from '@/components/layout'

interface EditProductPageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: EditProductPageProps): Promise<Metadata> {
  const { id } = await params
  return {
    title: `Edit Product ${id}`,
    description: 'Edit product details and information',
  }
}

export default async function EditProductPage({ params }: EditProductPageProps) {
  const { id } = await params
  
  // Server-side authentication check
  const user = await getCurrentUser()
  if (!user) {
    redirect('/login')
  }

  const hasAdminAccess = await isUserAdmin(user.id)
  if (!hasAdminAccess) {
    redirect('/unauthorized')
  }

  // Fetch product data
  const productResult = await productService.getProductById(id)
  
  if (!productResult.success || !productResult.data) {
    notFound()
  }

  const product = productResult.data

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Edit Product</h1>
          <p className="text-muted-foreground">
            Update {product.name} details
          </p>
        </div>
        
        <ProductForm 
          mode="edit" 
          initialData={product}
          productId={id}
        />
      </div>
    </AdminLayout>
  )
}