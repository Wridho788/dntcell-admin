import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getCurrentUser, isUserAdmin } from '@/lib/supabase/server'
import { productService } from '@/lib/services'
import { ProductsClient } from './products-client'
import type { ProductFilters } from '@/lib/services'

export const metadata: Metadata = {
  title: 'Products',
  description: 'Manage your product catalog',
}

interface ProductsPageProps {
  searchParams: Promise<{
    query?: string
    category?: string
    status?: string
    featured?: string
    minPrice?: string
    maxPrice?: string
    sort?: string
    order?: string
    page?: string
    limit?: string
  }>
}

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  // Await searchParams as required by Next.js 16
  const params = await searchParams
  // Server-side authentication check
  const user = await getCurrentUser()
  if (!user) {
    redirect('/login')
  }

  // Parse search parameters
  const productSearch: ProductFilters = {
    query: params.query,
    status: params.status as any,
    is_active: params.status === 'inactive' ? false : undefined,
    negotiable: params.featured === 'true' ? true : params.featured === 'false' ? false : undefined,
    min_price: params.minPrice ? parseFloat(params.minPrice) : undefined,
    max_price: params.maxPrice ? parseFloat(params.maxPrice) : undefined,
    sort_by: (params.sort as any) || 'created_at',
    sort_order: (params.order as any) || 'desc',
    page: params.page ? parseInt(params.page) : 1,
    limit: params.limit ? parseInt(params.limit) : 20,
  }

  // Fetch products
  const productsResult = await productService.getProducts(productSearch)
  
  if (!productsResult.success) {
    // Handle error case
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-destructive mb-2">Error Loading Products</h1>
          <p className="text-muted-foreground">{productsResult.error}</p>
        </div>
      </div>
    )
  }

  return (
    <ProductsClient
      initialData={productsResult.data!}
      searchParams={productSearch}
    />
  )
}