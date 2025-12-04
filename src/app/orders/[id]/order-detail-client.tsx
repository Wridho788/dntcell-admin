"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { getOrderById, updateOrderStatus, updatePaymentStatus } from "@/lib/actions"
import { type OrderStatus, type PaymentStatus } from "@/lib/validations/order"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { LoadingCard } from "@/components/ui/loading"
import { toast } from "sonner"
import Link from "next/link"
import Image from "next/image"
import { ArrowLeft, Package, User, CreditCard, Clock } from "lucide-react"

const orderStatusColors: Record<OrderStatus, string> = {
  pending: "bg-yellow-500",
  processing: "bg-blue-500",
  completed: "bg-green-500",
  cancelled: "bg-red-500",
}

const paymentStatusColors: Record<PaymentStatus, string> = {
  pending: "bg-yellow-500",
  paid: "bg-green-500",
  failed: "bg-red-500",
}

interface OrderDetailClientProps {
  orderId: string
}

export function OrderDetailClient({ orderId }: OrderDetailClientProps) {
  const queryClient = useQueryClient()
  const [selectedOrderStatus, setSelectedOrderStatus] = useState<OrderStatus | null>(null)
  const [selectedPaymentStatus, setSelectedPaymentStatus] = useState<PaymentStatus | null>(null)

  const { data: order, isLoading, error } = useQuery({
    queryKey: ["order", orderId],
    queryFn: async () => {
      const result = await getOrderById(orderId)

      if (!result.success || !result.data) {
        throw new Error(result.error || "Failed to fetch order")
      }

      return result.data
    },
    staleTime: 30000,
  })

  const updateOrderStatusMutation = useMutation({
    mutationFn: async (status: OrderStatus) => {
      const result = await updateOrderStatus({ id: orderId, order_status: status })
      if (!result.success) {
        throw new Error(result.error || "Failed to update order status")
      }
      return result.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order", orderId] })
      queryClient.invalidateQueries({ queryKey: ["orders"] })
      toast.success("Order status updated successfully")
      setSelectedOrderStatus(null)
    },
    onError: (error: Error) => {
      toast.error(`Failed to update order status: ${error.message}`)
    },
  })

  const updatePaymentStatusMutation = useMutation({
    mutationFn: async (status: PaymentStatus) => {
      const result = await updatePaymentStatus({ id: orderId, payment_status: status })
      if (!result.success) {
        throw new Error(result.error || "Failed to update payment status")
      }
      return result.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order", orderId] })
      queryClient.invalidateQueries({ queryKey: ["orders"] })
      toast.success("Payment status updated successfully")
      setSelectedPaymentStatus(null)
    },
    onError: (error: Error) => {
      toast.error(`Failed to update payment status: ${error.message}`)
    },
  })

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(price)
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString("id-ID", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <LoadingCard />
      </div>
    )
  }

  if (error || !order) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-red-500">
            Error loading order: {error?.message || "Order not found"}
          </p>
          <div className="text-center mt-4">
            <Link href="/orders">
              <Button variant="outline">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Orders
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/orders">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Order #{order.id.slice(0, 8)}
          </h1>
          <p className="text-muted-foreground">
            Created on {formatDate(order.created_at)}
          </p>
        </div>
      </div>

      {/* Status Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Order Status</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <Badge className={orderStatusColors[order.order_status]}>
              {order.order_status}
            </Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Payment Status</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <Badge className={paymentStatusColors[order.payment_status]}>
              {order.payment_status}
            </Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Final Price</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatPrice(order.final_price)}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Product Information */}
        <Card>
          <CardHeader>
            <CardTitle>Product Information</CardTitle>
          </CardHeader>
          <CardContent>
            {order.product && (
              <div className="space-y-4">
                {order.product.main_image_url && (
                  <div className="relative aspect-video rounded-lg overflow-hidden">
                    <Image
                      src={order.product.main_image_url}
                      alt={order.product.name}
                      fill
                      className="object-cover"
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <div>
                    <label className="text-sm text-muted-foreground">Product Name</label>
                    <div className="font-semibold">{order.product.name}</div>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Base Price</label>
                    <div className="font-semibold">
                      {formatPrice(order.product.base_price)}
                    </div>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">
                      Selling Price
                    </label>
                    <div className="font-semibold">
                      {formatPrice(order.product.selling_price)}
                    </div>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Final Price</label>
                    <div className="font-bold text-lg text-green-600">
                      {formatPrice(order.final_price)}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Buyer Information */}
        <Card>
          <CardHeader>
            <CardTitle>Buyer Information</CardTitle>
          </CardHeader>
          <CardContent>
            {order.buyer && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <div className="font-semibold">{order.buyer.full_name}</div>
                    <div className="text-sm text-muted-foreground">
                      {order.buyer.email}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment Information */}
        <Card>
          <CardHeader>
            <CardTitle>Payment Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-muted-foreground">
                  Payment Method
                </label>
                <div className="font-medium capitalize">
                  {order.payment_method.replace("_", " ")}
                </div>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">
                  Payment Status
                </label>
                <div className="mt-1">
                  <Badge className={paymentStatusColors[order.payment_status]}>
                    {order.payment_status}
                  </Badge>
                </div>
              </div>
              <div className="pt-4 border-t">
                <label className="text-sm font-medium mb-2 block">
                  Update Payment Status
                </label>
                <div className="flex gap-2">
                  <Select
                    value={selectedPaymentStatus || order.payment_status}
                    onValueChange={(value) =>
                      setSelectedPaymentStatus(value as PaymentStatus)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={() =>
                      selectedPaymentStatus &&
                      updatePaymentStatusMutation.mutate(selectedPaymentStatus)
                    }
                    disabled={
                      !selectedPaymentStatus ||
                      selectedPaymentStatus === order.payment_status ||
                      updatePaymentStatusMutation.isPending
                    }
                  >
                    Update
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Order Status Management */}
        <Card>
          <CardHeader>
            <CardTitle>Order Status Management</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-muted-foreground">
                  Current Status
                </label>
                <div className="mt-1">
                  <Badge className={orderStatusColors[order.order_status]}>
                    {order.order_status}
                  </Badge>
                </div>
              </div>
              <div className="pt-4 border-t">
                <label className="text-sm font-medium mb-2 block">
                  Update Order Status
                </label>
                <div className="flex gap-2">
                  <Select
                    value={selectedOrderStatus || order.order_status}
                    onValueChange={(value) =>
                      setSelectedOrderStatus(value as OrderStatus)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="processing">Processing</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={() =>
                      selectedOrderStatus &&
                      updateOrderStatusMutation.mutate(selectedOrderStatus)
                    }
                    disabled={
                      !selectedOrderStatus ||
                      selectedOrderStatus === order.order_status ||
                      updateOrderStatusMutation.isPending
                    }
                  >
                    Update
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Negotiation Details */}
      {order.negotiation && (
        <Card>
          <CardHeader>
            <CardTitle>Negotiation Details</CardTitle>
            <CardDescription>
              This order was created from an accepted negotiation
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm text-muted-foreground">
                  Original Offer
                </label>
                <div className="font-semibold">
                  {formatPrice(order.negotiation.offer_price)}
                </div>
              </div>
              {order.negotiation.counter_price && (
                <div>
                  <label className="text-sm text-muted-foreground">
                    Counter Offer
                  </label>
                  <div className="font-semibold">
                    {formatPrice(order.negotiation.counter_price)}
                  </div>
                </div>
              )}
              <div>
                <label className="text-sm text-muted-foreground">
                  Negotiation Status
                </label>
                <div className="mt-1">
                  <Badge className="bg-green-500">
                    {order.negotiation.status}
                  </Badge>
                </div>
              </div>
              {order.negotiation.admin_note && (
                <div className="md:col-span-2">
                  <label className="text-sm text-muted-foreground">
                    Admin Note
                  </label>
                  <div className="mt-1 p-3 bg-muted rounded-md">
                    {order.negotiation.admin_note}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Admin Note */}
      {order.admin_note && (
        <Card>
          <CardHeader>
            <CardTitle>Admin Note</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="p-3 bg-muted rounded-md">{order.admin_note}</div>
          </CardContent>
        </Card>
      )}

      {/* Timeline */}
      <Card>
        <CardHeader>
          <CardTitle>Order Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="mt-1">
                <Clock className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <div className="font-semibold">Order Created</div>
                <div className="text-sm text-muted-foreground">
                  {formatDate(order.created_at)}
                </div>
              </div>
            </div>
            {order.updated_at !== order.created_at && (
              <div className="flex gap-4">
                <div className="mt-1">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <div className="font-semibold">Last Updated</div>
                  <div className="text-sm text-muted-foreground">
                    {formatDate(order.updated_at)}
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
