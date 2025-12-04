'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ArrowLeft, Edit, Trash2, Copy, Eye, ExternalLink, MessageSquare } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { Product, ProductStatus } from '@/lib/validations/product'
import type { DbProduct } from '@/lib/services/ProductService'
import { ProductStatusActions } from './product-status-actions'
import { NegotiationsTable } from './negotiations-table'
import { getNegotiationsByProduct } from '@/lib/actions/negotiation-actions'
import { LoadingCard } from '@/components/ui/loading'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

interface ProductViewProps {
  product: DbProduct
}

export function ProductView({ product }: ProductViewProps) {
  const router = useRouter()
  const [selectedImage, setSelectedImage] = useState(0)
  const [activeTab, setActiveTab] = useState<string>('details')

  // Fetch negotiations for this product
  const {
    data: negotiationsResult,
    isLoading: negotiationsLoading,
    refetch: refetchNegotiations,
  } = useQuery({
    queryKey: ['negotiations', product.id],
    queryFn: async () => {
      const result = await getNegotiationsByProduct(product.id)
      if (!result.success) {
        throw new Error(result.error)
      }
      return result.data || []
    },
  })

  const negotiations = negotiationsResult || []
  const pendingCount = negotiations.filter(n => n.status === 'pending').length

  // DbProduct only has main_image_url, not product_images array
  const primaryImage = product.main_image_url ? { url: product.main_image_url, alt_text: product.name } : null
  const images = product.main_image_url ? [{ url: product.main_image_url, alt_text: product.name }] : []

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'outline'
      case 'pending_review': return 'default'
      case 'approved': return 'default'
      case 'rejected': return 'destructive'
      case 'active': return 'default'
      case 'inactive': return 'secondary'
      case 'archived': return 'destructive'
      default: return 'secondary'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'draft': return 'Draft'
      case 'pending_review': return 'Pending Review'
      case 'approved': return 'Disetujui'
      case 'rejected': return 'Ditolak'
      case 'active': return 'Active'
      case 'inactive': return 'Inactive'
      case 'archived': return 'Archived'
      default: return status
    }
  }

  // Calculate margin
  const margin = product.selling_price - product.base_price
  const getMarginColor = (margin: number) => {
    if (margin >= 300000) return 'text-green-600'
    if (margin >= 100000) return 'text-yellow-600'
    return 'text-red-600'
  }

  const handleEdit = () => {
    router.push(`/products/${product.id}/edit`)
  }

  const handleDuplicate = () => {
    // TODO: Implement duplicate functionality
    console.log('Duplicate product:', product.id)
  }

  const handleDelete = () => {
    // TODO: Implement delete functionality
    console.log('Delete product:', product.id)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            variant="outline"
            onClick={() => router.back()}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{product.name}</h1>
            <div className="flex items-center space-x-2 mt-1">
              <Badge variant={getStatusColor(product.status)}>
                {getStatusLabel(product.status)}
              </Badge>
              {product.negotiable && (
                <Badge variant="outline">
                  Bisa Nego
                </Badge>
              )}
              <span className="text-sm text-muted-foreground">ID: {product.id}</span>
            </div>
            
            {/* Reject Note Alert */}
            {product.status === 'rejected' && product.reject_note && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm font-medium text-red-800">Alasan Penolakan:</p>
                <p className="text-sm text-red-700 mt-1">{product.reject_note}</p>
              </div>
            )}
            
            {/* Status Actions */}
            <ProductStatusActions
              productId={product.id}
              productName={product.name}
              currentStatus={product.status as ProductStatus}
              className="mt-3"
            />
          </div>
        </div>
        
        <div className="flex space-x-2">
          <Button variant="outline" onClick={handleEdit}>
            <Edit className="mr-2 h-4 w-4" />
            Edit
          </Button>
          <Button variant="outline" onClick={handleDuplicate}>
            <Copy className="mr-2 h-4 w-4" />
            Duplicate
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Product</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete the product
                  "{product.name}" and all associated data.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete}>
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Images */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Product Images</CardTitle>
            </CardHeader>
            <CardContent>
              {images.length > 0 ? (
                <div className="space-y-4">
                  {/* Main Image */}
                  <div className="aspect-square relative bg-muted rounded-lg overflow-hidden">
                    <img
                      src={images[selectedImage]?.url || primaryImage?.url}
                      alt={images[selectedImage]?.alt_text || product.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        // Hide broken image and show fallback
                        e.currentTarget.style.display = 'none'
                        const parent = e.currentTarget.parentElement
                        if (parent) {
                          const fallback = parent.querySelector('.fallback-image')
                          if (fallback) {
                            fallback.classList.remove('hidden')
                          }
                        }
                      }}
                    />
                    <div className="fallback-image hidden absolute inset-0 w-full h-full items-center justify-center bg-muted">
                      <div className="text-center p-4">
                        <p className="text-sm text-muted-foreground">Image failed to load</p>
                        <p className="text-xs text-muted-foreground mt-1 break-all">{images[selectedImage]?.url || primaryImage?.url}</p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Thumbnail Grid */}
                  {images.length > 1 && (
                    <div className="grid grid-cols-4 gap-2">
                      {images.map((image, index) => (
                        <button
                          key={index}
                          onClick={() => setSelectedImage(index)}
                          className={`aspect-square relative bg-muted rounded-md overflow-hidden border-2 ${
                            selectedImage === index 
                              ? 'border-primary' 
                              : 'border-transparent hover:border-muted-foreground'
                          }`}
                        >
                          <img
                            src={image.url}
                            alt={image.alt_text || `${product.name} ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                          {index === 0 && (
                            <Badge 
                              className="absolute top-1 left-1 text-xs"
                              variant="default"
                            >
                              Main
                            </Badge>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="aspect-square bg-muted rounded-lg flex items-center justify-center">
                  <div className="text-center">
                    <Eye className="mx-auto h-12 w-12 text-muted-foreground" />
                    <p className="mt-2 text-sm text-muted-foreground">No images available</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Product Details */}
        <div className="space-y-6">
          {/* Pricing */}
          <Card>
            <CardHeader>
              <CardTitle>Harga</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Harga Asli (Base)</span>
                  <span className="font-mono">{formatCurrency(product.base_price)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Harga Jual</span>
                  <span className="text-2xl font-bold">{formatCurrency(product.selling_price)}</span>
                </div>
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Margin</span>
                  <span className={`font-mono font-bold ${getMarginColor(margin)}`}>
                    {formatCurrency(margin)}
                  </span>
                </div>
              </div>
              
              {margin < 100000 && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-sm text-red-800 font-medium">⚠️ Margin Rendah</p>
                  <p className="text-xs text-red-700">Margin di bawah standar minimum Rp 100.000</p>
                </div>
              )}
              
              {margin >= 300000 && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                  <p className="text-sm text-green-800 font-medium">✓ Margin Tinggi</p>
                  <p className="text-xs text-green-700">Profit bagus!</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Inventory */}
          <Card>
            <CardHeader>
              <CardTitle>Inventory</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Stock Quantity</span>
                <span className={`font-mono ${
                  (product.details?.stock || 0) <= 10 ? 'text-destructive font-bold' : ''
                }`}>
                  {product.details?.stock || 0}
                </span>
              </div>
              
              {(product.details?.stock || 0) <= 10 && (
                <div className="p-3 bg-destructive/10 rounded-md">
                  <p className="text-sm text-destructive font-medium">Low Stock Alert</p>
                  <p className="text-xs text-destructive">Consider restocking soon</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Additional Info */}
          <Card>
            <CardHeader>
              <CardTitle>Additional Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Condition</span>
                <span className="text-sm capitalize">{product.condition}</span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Negotiable</span>
                <span className="text-sm">{product.negotiable ? 'Yes' : 'No'}</span>
              </div>
              
              <Separator />
              
              <div className="space-y-2 text-xs text-muted-foreground">
                <div>Created: {formatDate(product.created_at!)}</div>
                <div>Status: {product.status}</div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Description */}
      {product.description && (
        <Card>
          <CardHeader>
            <CardTitle>Description</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none">
              <p className="whitespace-pre-wrap">{product.description}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Negotiations Section */}
      {product.negotiable && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <MessageSquare className="h-5 w-5" />
            <h2 className="text-xl font-semibold">Price Negotiations</h2>
            {pendingCount > 0 && (
              <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300">
                {pendingCount} Pending
              </Badge>
            )}
          </div>
          
          {negotiationsLoading ? (
            <LoadingCard text="Loading negotiations..." />
          ) : (
            <NegotiationsTable 
              negotiations={negotiations} 
              onUpdate={() => refetchNegotiations()}
            />
          )}
        </div>
      )}
    </div>
  )
}