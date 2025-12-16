'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useParams } from 'next/navigation'
import Image from 'next/image'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  ArrowLeft,
  Package,
  AlertCircle,
  MessageSquare,
  Loader2,
  CheckCircle2,
} from 'lucide-react'
import { api } from '@/lib/api-client'

export default function UserProductDetailPage() {
  const params = useParams()
  const router = useRouter()
  const queryClient = useQueryClient()
  const productId = params.id as string

  const [negotiationDialog, setNegotiationDialog] = useState(false)
  const [offerPrice, setOfferPrice] = useState('')
  const [notes, setNotes] = useState('')
  const [negotiationSuccess, setNegotiationSuccess] = useState(false)

  // Fetch product detail
  const { data: product, isLoading, error } = useQuery({
    queryKey: ['user-product', productId],
    queryFn: async () => {
      const result = await api.get<any>(`/products/${productId}`)
      if (!result.success) {
        throw new Error(result.error || 'Failed to load product')
      }
      return result.data
    },
    enabled: !!productId,
  })

  // Check if user has pending negotiation for this product
  const { data: userNegotiations } = useQuery({
    queryKey: ['user-negotiations', productId],
    queryFn: async () => {
      const result = await api.get<any[]>('/negotiations', {
        product_id: productId,
        status: 'pending',
      })
      return result.success ? result.data : []
    },
    enabled: !!productId,
  })

  // Create negotiation mutation
  const createNegotiation = useMutation({
    mutationFn: async (data: { product_id: string; offer_price: number; notes?: string }) => {
      const result = await api.post<any>('/negotiations', data)
      if (!result.success) {
        throw new Error(result.error || 'Failed to create negotiation')
      }
      return result.data
    },
    onSuccess: () => {
      setNegotiationSuccess(true)
      queryClient.invalidateQueries({ queryKey: ['user-negotiations', productId] })
      setTimeout(() => {
        setNegotiationDialog(false)
        setNegotiationSuccess(false)
        setOfferPrice('')
        setNotes('')
        router.push('/user/negotiations')
      }, 2000)
    },
  })

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(price)
  }

  const handleNegotiate = () => {
    const price = parseFloat(offerPrice)
    if (!price || price <= 0) {
      return
    }

    createNegotiation.mutate({
      product_id: productId,
      offer_price: price,
      notes: notes || undefined,
    })
  }

  const hasPendingNegotiation = userNegotiations && userNegotiations.length > 0

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <Skeleton className="h-8 w-32 mb-6" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Skeleton className="aspect-square w-full" />
            <div className="space-y-4">
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-6 w-1/2" />
              <Skeleton className="h-32 w-full" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <Button variant="ghost" onClick={() => router.back()} className="mb-6">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <Card className="p-8">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Failed to Load Product</h3>
              <p className="text-muted-foreground mb-4">
                {error instanceof Error ? error.message : 'Product not found'}
              </p>
              <Button onClick={() => router.back()}>Go Back</Button>
            </div>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Back Button */}
        <Button variant="ghost" onClick={() => router.back()} className="mb-6">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Products
        </Button>

        {/* Product Details */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Product Image */}
          <div className="relative aspect-square bg-muted rounded-lg overflow-hidden">
            {product.main_image_url ? (
              <Image
                src={product.main_image_url}
                alt={product.name}
                fill
                className="object-cover"
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <Package className="h-24 w-24 text-muted-foreground" />
              </div>
            )}
          </div>

          {/* Product Info */}
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold mb-4">{product.name}</h1>
              
              <div className="flex gap-2 mb-4">
                {product.negotiable && (
                  <Badge variant="secondary" className="bg-green-100 text-green-800">
                    Negotiable
                  </Badge>
                )}
                {product.condition && (
                  <Badge variant="outline">{product.condition}</Badge>
                )}
                {product.status && (
                  <Badge>{product.status}</Badge>
                )}
              </div>

              <div className="space-y-2 mb-6">
                {product.selling_price && (
                  <div>
                    <span className="text-4xl font-bold text-primary">
                      {formatPrice(product.selling_price)}
                    </span>
                  </div>
                )}
                {product.base_price && product.selling_price !== product.base_price && (
                  <div>
                    <span className="text-lg text-muted-foreground line-through">
                      {formatPrice(product.base_price)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Description */}
            {product.description && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Description</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground whitespace-pre-wrap">
                    {product.description}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Specifications */}
            {product.specs && Object.keys(product.specs).length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Specifications</CardTitle>
                </CardHeader>
                <CardContent>
                  <dl className="space-y-2">
                    {Object.entries(product.specs).map(([key, value]) => (
                      <div key={key} className="flex justify-between">
                        <dt className="font-medium">{key}:</dt>
                        <dd className="text-muted-foreground">{String(value)}</dd>
                      </div>
                    ))}
                  </dl>
                </CardContent>
              </Card>
            )}

            {/* Actions */}
            <div className="space-y-3">
              {product.negotiable && !hasPendingNegotiation && (
                <Button
                  size="lg"
                  className="w-full"
                  onClick={() => setNegotiationDialog(true)}
                >
                  <MessageSquare className="h-5 w-5 mr-2" />
                  Request Negotiation
                </Button>
              )}
              
              {hasPendingNegotiation && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <p className="text-sm text-amber-800">
                    You have a pending negotiation for this product. Check your negotiations page for updates.
                  </p>
                  <Button
                    variant="outline"
                    className="mt-2"
                    onClick={() => router.push('/user/negotiations')}
                  >
                    View Negotiation
                  </Button>
                </div>
              )}
              
              {!product.negotiable && (
                <Button size="lg" className="w-full" disabled>
                  Contact for Purchase
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Negotiation Dialog */}
      <Dialog open={negotiationDialog} onOpenChange={setNegotiationDialog}>
        <DialogContent>
          {negotiationSuccess ? (
            <div className="text-center py-6">
              <CheckCircle2 className="h-16 w-16 text-green-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Negotiation Submitted!</h3>
              <p className="text-muted-foreground">
                Your negotiation request has been submitted. We'll notify you once the admin responds.
              </p>
            </div>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Request Negotiation</DialogTitle>
                <DialogDescription>
                  Submit your offer for {product.name}. The admin will review and respond to your request.
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                <div>
                  <Label>Current Price</Label>
                  <div className="text-2xl font-bold text-primary mt-1">
                    {formatPrice(product.selling_price || product.base_price)}
                  </div>
                </div>

                <div>
                  <Label htmlFor="offer">Your Offer Price</Label>
                  <Input
                    id="offer"
                    type="number"
                    placeholder="Enter your offer amount"
                    value={offerPrice}
                    onChange={(e) => setOfferPrice(e.target.value)}
                    disabled={createNegotiation.isPending}
                  />
                </div>

                <div>
                  <Label htmlFor="notes">Notes (Optional)</Label>
                  <Textarea
                    id="notes"
                    placeholder="Add any additional information..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    disabled={createNegotiation.isPending}
                    rows={3}
                  />
                </div>

                {createNegotiation.error && (
                  <div className="flex items-center space-x-2 text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                    <AlertCircle className="h-4 w-4" />
                    <span>
                      {createNegotiation.error instanceof Error
                        ? createNegotiation.error.message
                        : 'Failed to submit negotiation'}
                    </span>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setNegotiationDialog(false)}
                  disabled={createNegotiation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleNegotiate}
                  disabled={createNegotiation.isPending || !offerPrice}
                >
                  {createNegotiation.isPending && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  Submit Negotiation
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
