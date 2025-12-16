'use client'

import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Package,
  AlertCircle,
  Clock,
  CheckCircle2,
  XCircle,
  MessageSquare,
  ShoppingCart,
} from 'lucide-react'
import { api } from '@/lib/api-client'

type NegotiationStatus = 'all' | 'pending' | 'approved' | 'rejected'

export default function UserNegotiationsPage() {
  const router = useRouter()
  const [status, setStatus] = useState<NegotiationStatus>('all')

  const { data: negotiations, isLoading, error } = useQuery({
    queryKey: ['user-negotiations', status],
    queryFn: async () => {
      const result = await api.get<any[]>('/negotiations', {
        status: status !== 'all' ? status : undefined,
        page: 1,
        limit: 50,
      })
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to load negotiations')
      }
      
      return result.data || []
    },
  })

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(price)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  const getStatusIcon = (negStatus: string) => {
    switch (negStatus) {
      case 'pending':
        return <Clock className="h-4 w-4" />
      case 'approved':
        return <CheckCircle2 className="h-4 w-4" />
      case 'rejected':
        return <XCircle className="h-4 w-4" />
      case 'countered':
        return <MessageSquare className="h-4 w-4" />
      default:
        return <MessageSquare className="h-4 w-4" />
    }
  }

  const getStatusColor = (negStatus: string) => {
    switch (negStatus) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'approved':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'rejected':
        return 'bg-red-100 text-red-800 border-red-200'
      case 'countered':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const filteredNegotiations = negotiations || []

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b">
        <div className="container mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold mb-4">My Negotiations</h1>
          
          {/* Status Tabs */}
          <Tabs value={status} onValueChange={(v) => setStatus(v as NegotiationStatus)}>
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="pending">Pending</TabsTrigger>
              <TabsTrigger value="approved">Approved</TabsTrigger>
              <TabsTrigger value="rejected">Rejected</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8">
        {/* Loading State */}
        {isLoading && (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <div className="flex gap-4">
                    <Skeleton className="h-24 w-24" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-4 w-1/2" />
                      <Skeleton className="h-4 w-1/4" />
                    </div>
                  </div>
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
              <h3 className="text-lg font-semibold mb-2">Failed to Load Negotiations</h3>
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
        {!isLoading && !error && filteredNegotiations.length === 0 && (
          <Card className="p-12">
            <div className="text-center">
              <MessageSquare className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">No Negotiations Yet</h3>
              <p className="text-muted-foreground mb-6">
                Start negotiating prices on products you're interested in!
              </p>
              <Button onClick={() => router.push('/user/products')}>
                Browse Products
              </Button>
            </div>
          </Card>
        )}

        {/* Negotiations List */}
        {!isLoading && !error && filteredNegotiations.length > 0 && (
          <div className="space-y-4">
            {filteredNegotiations.map((negotiation) => (
              <Card
                key={negotiation.id}
                className="hover:shadow-md transition-shadow"
              >
                <CardContent className="p-6">
                  <div className="flex gap-4">
                    {/* Product Image */}
                    <div className="relative h-24 w-24 bg-muted rounded-lg overflow-hidden shrink-0">
                      {negotiation.product?.main_image_url ? (
                        <Image
                          src={negotiation.product.main_image_url}
                          alt={negotiation.product.name}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <Package className="h-8 w-8 text-muted-foreground" />
                        </div>
                      )}
                    </div>

                    {/* Negotiation Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4 mb-2">
                        <div>
                          <h3 className="font-semibold text-lg mb-1">
                            {negotiation.product?.name || 'Product'}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            Negotiation #{negotiation.id.slice(0, 8).toUpperCase()}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                        <div>
                          <span className="text-xs text-muted-foreground">Original Price</span>
                          <p className="font-semibold text-sm">
                            {formatPrice(negotiation.product?.selling_price || negotiation.product?.base_price || 0)}
                          </p>
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground">Your Offer</span>
                          <p className="font-semibold text-sm text-blue-600">
                            {formatPrice(negotiation.offer_price)}
                          </p>
                        </div>
                        {negotiation.counter_price && (
                          <div>
                            <span className="text-xs text-muted-foreground">Counter Offer</span>
                            <p className="font-semibold text-sm text-amber-600">
                              {formatPrice(negotiation.counter_price)}
                            </p>
                          </div>
                        )}
                        {negotiation.final_price && (
                          <div>
                            <span className="text-xs text-muted-foreground">Final Price</span>
                            <p className="font-semibold text-sm text-green-600">
                              {formatPrice(negotiation.final_price)}
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 mb-3">
                        <Badge className={getStatusColor(negotiation.status)}>
                          {getStatusIcon(negotiation.status)}
                          <span className="ml-1 capitalize">{negotiation.status}</span>
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {formatDate(negotiation.created_at)}
                        </span>
                      </div>

                      {/* Status-specific Messages and Actions */}
                      {negotiation.status === 'pending' && (
                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                          <p className="text-sm text-yellow-800">
                            <Clock className="h-4 w-4 inline mr-1" />
                            Waiting for admin response...
                          </p>
                        </div>
                      )}

                      {negotiation.status === 'approved' && (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center justify-between">
                          <p className="text-sm text-green-800">
                            <CheckCircle2 className="h-4 w-4 inline mr-1" />
                            Your negotiation was approved! An order has been created.
                          </p>
                          <Button
                            size="sm"
                            onClick={() => router.push('/user/orders')}
                          >
                            <ShoppingCart className="h-4 w-4 mr-1" />
                            View Orders
                          </Button>
                        </div>
                      )}

                      {negotiation.status === 'rejected' && negotiation.admin_notes && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                          <p className="text-sm text-red-800 font-medium mb-1">
                            <XCircle className="h-4 w-4 inline mr-1" />
                            Rejected
                          </p>
                          <p className="text-sm text-red-700">
                            {negotiation.admin_notes}
                          </p>
                        </div>
                      )}

                      {negotiation.status === 'countered' && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                          <p className="text-sm text-blue-800 mb-2">
                            <MessageSquare className="h-4 w-4 inline mr-1" />
                            Admin sent a counter offer: {formatPrice(negotiation.counter_price || 0)}
                          </p>
                          {negotiation.admin_notes && (
                            <p className="text-sm text-blue-700">
                              Note: {negotiation.admin_notes}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// Import useState hook
import { useState } from 'react'
