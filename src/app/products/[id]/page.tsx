import { Metadata } from 'next'
import { redirect, notFound } from 'next/navigation'
import { getCurrentUser, isUserAdmin } from '@/lib/supabase/server'
import { productService } from '@/lib/services'
import { ProductView } from '@/components/products/product-view'
import { AdminLayout } from '@/components/layout'

interface ProductPageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { id } = await params
  
  const productResult = await productService.getProductById(id)
  const product = productResult.success ? productResult.data : null
  
  return {
    title: product ? `${product.name} | Product Details` : 'Product Details',
    description: product ? product.description : 'View product details',
  }
}

export default async function ProductPage({ params }: ProductPageProps) {
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

  return (
    <AdminLayout>
      <ProductView product={productResult.data} />
    </AdminLayout>
  )
}