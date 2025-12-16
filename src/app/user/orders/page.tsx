'use client'

import { useState } from 'react'
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
  Loader,
  ShoppingBag,
} from 'lucide-react'
import { api } from '@/lib/api-client'

type OrderStatus = 'all' | 'pending' | 'processing' | 'completed' | 'cancelled'

export default function UserOrdersPage() {
  const router = useRouter()
  const [status, setStatus] = useState<OrderStatus>('all')

  const { data: orders, isLoading, error } = useQuery({
    queryKey: ['user-orders', status],
    queryFn: async () => {
      const result = await api.get<any[]>('/orders', {
        order_status: status !== 'all' ? status : undefined,
        page: 1,
        limit: 50,
      })
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to load orders')
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

  const getStatusIcon = (orderStatus: string) => {
    switch (orderStatus) {
      case 'pending':
        return <Clock className="h-4 w-4" />
      case 'processing':
        return <Loader className="h-4 w-4" />
      case 'completed':
        return <CheckCircle2 className="h-4 w-4" />
      case 'cancelled':
        return <XCircle className="h-4 w-4" />
      default:
        return <Package className="h-4 w-4" />
    }
  }

  const getStatusColor = (orderStatus: string) => {
    switch (orderStatus) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'processing':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'cancelled':
        return 'bg-red-100 text-red-800 border-red-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getPaymentStatusColor = (paymentStatus: string) => {
    switch (paymentStatus) {
      case 'pending':
        return 'bg-amber-100 text-amber-800'
      case 'paid':
        return 'bg-green-100 text-green-800'
      case 'failed':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const filteredOrders = orders || []

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b">
        <div className="container mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold mb-4">My Orders</h1>
          
          {/* Status Tabs */}
          <Tabs value={status} onValueChange={(v) => setStatus(v as OrderStatus)}>
            <TabsList>
              <TabsTrigger value="all">All Orders</TabsTrigger>
              <TabsTrigger value="pending">Pending</TabsTrigger>
              <TabsTrigger value="processing">Processing</TabsTrigger>
              <TabsTrigger value="completed">Completed</TabsTrigger>
              <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
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
              <h3 className="text-lg font-semibold mb-2">Failed to Load Orders</h3>
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
        {!isLoading && !error && filteredOrders.length === 0 && (
          <Card className="p-12">
            <div className="text-center">
              <ShoppingBag className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">No Orders Yet</h3>
              <p className="text-muted-foreground mb-6">
                You haven't placed any orders yet. Browse our products to get started!
              </p>
              <Button onClick={() => router.push('/user/products')}>
                Browse Products
              </Button>
            </div>
          </Card>
        )}

        {/* Orders List */}
        {!isLoading && !error && filteredOrders.length > 0 && (
          <div className="space-y-4">
            {filteredOrders.map((order) => (
              <Card
                key={order.id}
                className="hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => router.push(`/user/orders/${order.id}`)}
              >
                <CardContent className="p-6">
                  <div className="flex gap-4">
                    {/* Product Image */}
                    <div className="relative h-24 w-24 bg-muted rounded-lg overflow-hidden shrink-0">
                      {order.product?.main_image_url ? (
                        <Image
                          src={order.product.main_image_url}
                          alt={order.product.name}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <Package className="h-8 w-8 text-muted-foreground" />
                        </div>
                      )}
                    </div>

                    {/* Order Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4 mb-2">
                        <div>
                          <h3 className="font-semibold text-lg mb-1">
                            {order.product?.name || 'Product'}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            Order #{order.id.slice(0, 8).toUpperCase()}
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-primary">
                            {formatPrice(order.final_price)}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 mb-3">
                        <Badge className={getStatusColor(order.order_status)}>
                          {getStatusIcon(order.order_status)}
                          <span className="ml-1 capitalize">{order.order_status}</span>
                        </Badge>
                        <Badge variant="outline" className={getPaymentStatusColor(order.payment_status)}>
                          Payment: {order.payment_status}
                        </Badge>
                        {order.payment_method && (
                          <Badge variant="outline">
                            {order.payment_method}
                          </Badge>
                        )}
                        {order.negotiation && (
                          <Badge variant="secondary">
                            From Negotiation
                          </Badge>
                        )}
                      </div>

                      <div className="text-sm text-muted-foreground">
                        Ordered on {formatDate(order.created_at)}
                      </div>
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
