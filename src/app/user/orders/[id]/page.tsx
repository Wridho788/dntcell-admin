'use client'

import { useRouter, useParams } from 'next/navigation'
import Image from 'next/image'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ArrowLeft,
  Package,
  AlertCircle,
  Clock,
  CheckCircle2,
  XCircle,
  User,
  CreditCard,
  MessageSquare,
} from 'lucide-react'
import { api } from '@/lib/api-client'

export default function UserOrderDetailPage() {
  const params = useParams()
  const router = useRouter()
  const orderId = params.id as string

  const { data: order, isLoading, error } = useQuery({
    queryKey: ['user-order', orderId],
    queryFn: async () => {
      const result = await api.get<any>(`/orders/${orderId}`)
      if (!result.success) {
        throw new Error(result.error || 'Failed to load order')
      }
      return result.data
    },
    enabled: !!orderId,
  })

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(price)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('id-ID', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-5 w-5" />
      case 'processing':
        return <Package className="h-5 w-5" />
      case 'completed':
        return <CheckCircle2 className="h-5 w-5" />
      case 'cancelled':
        return <XCircle className="h-5 w-5" />
      default:
        return <Package className="h-5 w-5" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      case 'processing':
        return 'bg-blue-100 text-blue-800'
      case 'completed':
        return 'bg-green-100 text-green-800'
      case 'cancelled':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <Skeleton className="h-8 w-32 mb-6" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Skeleton className="h-64 w-full" />
              <Skeleton className="h-48 w-full" />
            </div>
            <Skeleton className="h-96 w-full" />
          </div>
        </div>
      </div>
    )
  }

  if (error || !order) {
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
              <h3 className="text-lg font-semibold mb-2">Failed to Load Order</h3>
              <p className="text-muted-foreground mb-4">
                {error instanceof Error ? error.message : 'Order not found'}
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
          Back to Orders
        </Button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Order Header */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-2xl">
                      Order #{order.id.slice(0, 8).toUpperCase()}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      Placed on {formatDate(order.created_at)}
                    </p>
                  </div>
                  <Badge className={getStatusColor(order.order_status)} variant="outline">
                    {getStatusIcon(order.order_status)}
                    <span className="ml-2 capitalize">{order.order_status}</span>
                  </Badge>
                </div>
              </CardHeader>
            </Card>

            {/* Product Info */}
            <Card>
              <CardHeader>
                <CardTitle>Product Details</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4">
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
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg mb-1">
                      {order.product?.name || 'Product'}
                    </h3>
                    {order.product?.condition && (
                      <Badge variant="outline" className="mb-2">
                        {order.product.condition}
                      </Badge>
                    )}
                    <div className="text-2xl font-bold text-primary mt-2">
                      {formatPrice(order.final_price)}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Negotiation Info (if from negotiation) */}
            {order.negotiation && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <MessageSquare className="h-5 w-5 mr-2" />
                    Negotiation Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Your Offer:</span>
                    <span className="font-semibold">
                      {formatPrice(order.negotiation.offer_price)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Final Price:</span>
                    <span className="font-semibold text-primary">
                      {formatPrice(order.negotiation.final_price || order.final_price)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status:</span>
                    <Badge className="bg-green-100 text-green-800">
                      {order.negotiation.status}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Order Timeline */}
            <Card>
              <CardHeader>
                <CardTitle>Order Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    {
                      status: 'pending',
                      label: 'Order Placed',
                      date: order.created_at,
                      active: true,
                    },
                    {
                      status: 'processing',
                      label: 'Processing',
                      date: order.order_status === 'processing' || order.order_status === 'completed' ? order.updated_at : null,
                      active: order.order_status === 'processing' || order.order_status === 'completed',
                    },
                    {
                      status: 'completed',
                      label: 'Completed',
                      date: order.order_status === 'completed' ? order.updated_at : null,
                      active: order.order_status === 'completed',
                    },
                  ].map((step, index) => (
                    <div key={step.status} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div
                          className={`flex h-10 w-10 items-center justify-center rounded-full border-2 ${
                            step.active
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-muted bg-muted text-muted-foreground'
                          }`}
                        >
                          {getStatusIcon(step.status)}
                        </div>
                        {index < 2 && (
                          <div className={`h-12 w-0.5 ${step.active ? 'bg-primary' : 'bg-muted'}`} />
                        )}
                      </div>
                      <div className="pb-8">
                        <h4 className={`font-semibold ${step.active ? 'text-foreground' : 'text-muted-foreground'}`}>
                          {step.label}
                        </h4>
                        {step.date && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {formatDate(step.date)}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Cancelled Status */}
                  {order.order_status === 'cancelled' && (
                    <div className="flex gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-red-500 bg-red-500 text-white">
                        <XCircle className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-red-600">Cancelled</h4>
                        <p className="text-sm text-muted-foreground mt-1">
                          {formatDate(order.updated_at)}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Payment Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center text-lg">
                  <CreditCard className="h-5 w-5 mr-2" />
                  Payment Info
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <span className="text-sm text-muted-foreground">Payment Status:</span>
                  <Badge
                    className={`ml-2 ${
                      order.payment_status === 'paid'
                        ? 'bg-green-100 text-green-800'
                        : order.payment_status === 'failed'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {order.payment_status}
                  </Badge>
                </div>
                {order.payment_method && (
                  <div>
                    <span className="text-sm text-muted-foreground">Payment Method:</span>
                    <p className="font-medium capitalize">{order.payment_method}</p>
                  </div>
                )}
                {order.payment_proof_url && (
                  <div>
                    <span className="text-sm text-muted-foreground">Payment Proof:</span>
                    <a
                      href={order.payment_proof_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline block"
                    >
                      View Proof
                    </a>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Buyer Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center text-lg">
                  <User className="h-5 w-5 mr-2" />
                  Your Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div>
                  <span className="text-sm text-muted-foreground">Name:</span>
                  <p className="font-medium">{order.buyer?.full_name || 'N/A'}</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Email:</span>
                  <p className="font-medium">{order.buyer?.email || 'N/A'}</p>
                </div>
              </CardContent>
            </Card>

            {/* Admin Notes (if any) */}
            {order.admin_note && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Admin Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {order.admin_note}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
