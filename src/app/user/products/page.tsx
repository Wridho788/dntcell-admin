'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Search, ShoppingCart, AlertCircle, Package } from 'lucide-react'
import { api } from '@/lib/api-client'

export default function UserProductsPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const router = useRouter()

  const { data: response, isLoading, error } = useQuery({
    queryKey: ['user-products', searchQuery],
    queryFn: async () => {
      const result = await api.getProducts({
        query: searchQuery || undefined,
        status: 'active',
        is_active: true,
        page: 1,
        limit: 50,
        sort_by: 'created_at',
        sort_order: 'desc',
      })
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to load products')
      }
      
      return result.data
    },
  })

  const data = response?.products || []

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(price)
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b">
        <div className="container mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold mb-4">DNTCELL Products</h1>
          
          {/* Search Bar */}
          <div className="max-w-xl">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8">
        {/* Loading State */}
        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <Card key={i}>
                <Skeleton className="aspect-square w-full" />
                <CardContent className="p-4">
                  <Skeleton className="h-4 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-1/2" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Error State */}
        {error && (
          <Card className="p-8">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Failed to Load Products</h3>
              <p className="text-muted-foreground mb-4">
                {error instanceof Error ? error.message : 'Something went wrong'}
              </p>
              <Button onClick={() => window.location.reload()}>
                Try Again
              </Button>
            </div>
          </Card>
        )}

        {/* Empty State */}
        {!isLoading && !error && data && data.length === 0 && (
          <Card className="p-12">
            <div className="text-center">
              <Package className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">No Products Found</h3>
              <p className="text-muted-foreground">
                {searchQuery
                  ? `No products match your search "${searchQuery}"`
                  : 'No products available at the moment'}
              </p>
            </div>
          </Card>
        )}

        {/* Product Grid */}
        {!isLoading && !error && data && data.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {data.map((product) => (
              <Card
                key={product.id}
                className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => router.push(`/user/products/${product.id}`)}
              >
                {/* Product Image */}
                <div className="relative aspect-square bg-muted">
                  {product.main_image_url ? (
                    <Image
                      src={product.main_image_url}
                      alt={product.name}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <Package className="h-16 w-16 text-muted-foreground" />
                    </div>
                  )}
                  
                  {/* Badges */}
                  <div className="absolute top-2 left-2 flex flex-col gap-2">
                    {product.negotiable && (
                      <Badge variant="secondary" className="bg-green-100 text-green-800">
                        Negotiable
                      </Badge>
                    )}
                    {product.condition && (
                      <Badge variant="outline">
                        {product.condition}
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Product Info */}
                <CardContent className="p-4">
                  <h3 className="font-semibold text-lg mb-2 line-clamp-2">
                    {product.name}
                  </h3>
                  
                  <div className="space-y-1">
                    {product.selling_price && (
                      <div>
                        <span className="text-2xl font-bold text-primary">
                          {formatPrice(product.selling_price)}
                        </span>
                      </div>
                    )}
                    {product.base_price && product.selling_price !== product.base_price && (
                      <div>
                        <span className="text-sm text-muted-foreground line-through">
                          {formatPrice(product.base_price)}
                        </span>
                      </div>
                    )}
                  </div>
                </CardContent>

                <CardFooter className="p-4 pt-0">
                  <Button
                    className="w-full"
                    onClick={(e) => {
                      e.stopPropagation()
                      router.push(`/user/products/${product.id}`)
                    }}
                  >
                    <ShoppingCart className="h-4 w-4 mr-2" />
                    View Details
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
