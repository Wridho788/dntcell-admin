'use client'

import { useState } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { AdminLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ProductsTable } from '@/components/products/products-table'
import { ProductFilters } from '@/components/products/product-filters'
import { ProductStats } from '@/components/products/product-stats'
import { Plus, Search, Filter, RefreshCw } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { productService } from '@/lib/services'
// import type { Product, ProductSearch } from '@/lib/validations/product'

interface ProductsClientProps {
  initialData: {
    products: any[]
    total: number
    totalPages: number
  }
  searchParams: any
}

export function ProductsClient({ initialData, searchParams }: ProductsClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParamsObj = useSearchParams()
  const [showFilters, setShowFilters] = useState(false)

  // Query for products with React Query
  const {
    data = initialData,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['products', searchParams],
    queryFn: () => productService.getProducts(searchParams),
    initialData: { success: true, data: initialData },
    select: (result) => result.success ? result.data! : initialData,
    staleTime: 30000, // 30 seconds
  })

  // Update URL with new search parameters
  const updateSearchParams = (updates: any) => {
    const params = new URLSearchParams(searchParamsObj.toString())
    
    Object.entries(updates).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') {
        params.delete(key)
      } else {
        params.set(key, String(value))
      }
    })
    
    router.push(`${pathname}?${params.toString()}`)
  }

  // Handle search
  const handleSearch = (query: string) => {
    updateSearchParams({ query, page: 1 })
  }

  // Handle refresh
  const handleRefresh = () => {
    refetch()
  }

  // Handle create new product
  const handleCreateProduct = () => {
    router.push('/products/new')
  }

  return (
    <AdminLayout>
      <div className="page-container">
        {/* Header */}
        <div className="page-header">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="page-title">Produk</h1>
              <p className="page-description">
                Kelola katalog produk dan inventaris Anda
              </p>
            </div>
            
            <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={handleRefresh}
              disabled={isLoading}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Muat Ulang
            </Button>
            <Button onClick={handleCreateProduct}>
              <Plus className="mr-2 h-4 w-4" />
              Tambah Produk
            </Button>
            </div>
          </div>
        </div>

        {/* Stats */}
        <ProductStats
          total={data.total}
          products={data.products}
        />

        {/* Search and Filters */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Cari Produk</CardTitle>
                <CardDescription>
                  Temukan produk berdasarkan nama, SKU, atau deskripsi
                </CardDescription>
              </div>
              <Button
                variant="outline"
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter className="mr-2 h-4 w-4" />
                Filter
              </Button>
            </div>
          </CardHeader>
          <CardContent className="my-4 space-y-4">
            {/* Search Bar */}
            <div className="flex space-x-2">
              <div className="flex-1">
                <Input
                  placeholder="Cari produk..."
                  value={searchParams.query || ''}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="w-full"
                />
              </div>
              <Button variant="outline">
                <Search className="h-4 w-4" />
              </Button>
            </div>

            {/* Advanced Filters */}
            {showFilters && (
              <ProductFilters
                filters={searchParams}
                onFiltersChange={updateSearchParams}
              />
            )}
          </CardContent>
        </Card>

        {/* Products Table */}
        <Card>
          <CardHeader>
            <CardTitle>Produk ({data.total})</CardTitle>
            <CardDescription>
              Menampilkan {data.products.length} dari {data.total} produk
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ProductsTable
              products={data.products}
              isLoading={isLoading}
              onRefresh={handleRefresh}
              searchParams={searchParams}
              onSearchParamsChange={updateSearchParams}
              totalProducts={data.total}
              totalPages={data.totalPages}
            />
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  )
}