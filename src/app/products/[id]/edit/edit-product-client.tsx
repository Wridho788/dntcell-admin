'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { AdminLayout } from '@/components/layout'
import { ProductForm } from '@/components/products/product-form'
import { AuthWrapper } from '@/components/auth'
import { productService } from '@/lib/services'
import { LoadingScreen } from '@/components/ui/loading'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AlertCircle } from 'lucide-react'
import type { DbProduct } from '@/lib/services/ProductService'

export function EditProductClient() {
  const params = useParams()
  const router = useRouter()
  const productId = params.id as string
  const [product, setProduct] = useState<DbProduct | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        setLoading(true)
        const result = await productService.getProductById(productId)
        
        if (result.success && result.data) {
          setProduct(result.data)
        } else {
          setError(result.error || 'Product not found')
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load product')
      } finally {
        setLoading(false)
      }
    }

    fetchProduct()
  }, [productId])

  if (loading) {
    return (
      <AuthWrapper requireAdmin={true}>
        <AdminLayout>
          <LoadingScreen text="Memuat data produk..." />
        </AdminLayout>
      </AuthWrapper>
    )
  }

  if (error || !product) {
    return (
      <AuthWrapper requireAdmin={true}>
        <AdminLayout>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center space-y-4">
                <AlertCircle className="mx-auto h-12 w-12 text-red-500" />
                <div>
                  <h3 className="text-lg font-semibold">Product Not Found</h3>
                  <p className="text-muted-foreground mt-2">
                    {error || 'The product you are looking for does not exist.'}
                  </p>
                </div>
                <Button onClick={() => router.push('/products')}>
                  Back to Products
                </Button>
              </div>
            </CardContent>
          </Card>
        </AdminLayout>
      </AuthWrapper>
    )
  }

  return (
    <AuthWrapper requireAdmin={true}>
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
            productId={productId}
          />
        </div>
      </AdminLayout>
    </AuthWrapper>
  )
}
