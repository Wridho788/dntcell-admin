"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useQuery } from "@tanstack/react-query"
import { format } from "date-fns"
import { id as localeId } from "date-fns/locale"
import { Loader2, Package, CreditCard, CheckCircle, XCircle, Clock, Truck } from "lucide-react"

interface OrderStatusHistoryProps {
  orderId: string
}

const ORDER_STATUS_CONFIG = {
  pending: { 
    label: "Pending", 
    color: "bg-yellow-500/10 text-yellow-700 border-yellow-200",
    icon: Clock 
  },
  processing: { 
    label: "Processing", 
    color: "bg-blue-500/10 text-blue-700 border-blue-200",
    icon: Package 
  },
  completed: { 
    label: "Completed", 
    color: "bg-green-500/10 text-green-700 border-green-200",
    icon: CheckCircle 
  },
  canceled: { 
    label: "Canceled", 
    color: "bg-red-500/10 text-red-700 border-red-200",
    icon: XCircle 
  },
  shipped: { 
    label: "Shipped", 
    color: "bg-purple-500/10 text-purple-700 border-purple-200",
    icon: Truck 
  },
} as const

const PAYMENT_STATUS_CONFIG = {
  pending: { 
    label: "Payment Pending", 
    color: "bg-yellow-500/10 text-yellow-700 border-yellow-200",
    icon: Clock 
  },
  paid: { 
    label: "Paid", 
    color: "bg-green-500/10 text-green-700 border-green-200",
    icon: CheckCircle 
  },
  failed: { 
    label: "Payment Failed", 
    color: "bg-red-500/10 text-red-700 border-red-200",
    icon: XCircle 
  },
} as const

const ACTION_CONFIG = {
  ORDER_CREATED: { 
    label: "Order Created", 
    color: "bg-blue-500/10 text-blue-700 border-blue-200",
    icon: Package 
  },
  ORDER_PAID: { 
    label: "Payment Confirmed", 
    color: "bg-green-500/10 text-green-700 border-green-200",
    icon: CheckCircle 
  },
  ORDER_SHIPPED: { 
    label: "Order Shipped", 
    color: "bg-purple-500/10 text-purple-700 border-purple-200",
    icon: Truck 
  },
  ORDER_COMPLETED: { 
    label: "Order Completed", 
    color: "bg-green-500/10 text-green-700 border-green-200",
    icon: CheckCircle 
  },
  ORDER_CANCELLED: { 
    label: "Order Cancelled", 
    color: "bg-red-500/10 text-red-700 border-red-200",
    icon: XCircle 
  },
  ORDER_STATUS_CHANGED: { 
    label: "Status Updated", 
    color: "bg-yellow-500/10 text-yellow-700 border-yellow-200",
    icon: Package 
  },
  DEFAULT: { 
    label: "Status Change", 
    color: "bg-gray-500/10 text-gray-700 border-gray-200",
    icon: Clock 
  },
} as const

type ActionType = keyof typeof ACTION_CONFIG

function getActionConfig(action: string) {
  return ACTION_CONFIG[action as ActionType] || ACTION_CONFIG.DEFAULT
}

function getStatusConfig(status: string, isPayment: boolean = false) {
  if (isPayment) {
    return PAYMENT_STATUS_CONFIG[status as keyof typeof PAYMENT_STATUS_CONFIG] || PAYMENT_STATUS_CONFIG.pending
  }
  return ORDER_STATUS_CONFIG[status as keyof typeof ORDER_STATUS_CONFIG] || ORDER_STATUS_CONFIG.pending
}

export function OrderStatusHistory({ orderId }: OrderStatusHistoryProps) {
  const { data: activities, isLoading, error } = useQuery({
    queryKey: ["activity-logs", "order", orderId],
    queryFn: async () => {
      const response = await fetch(`/api/activity?order_id=${orderId}`)
      if (!response.ok) {
        throw new Error("Failed to fetch order history")
      }
      const result = await response.json()
      return result.data?.logs || []
    },
    staleTime: 30000,
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Status Change History</CardTitle>
        <CardDescription>
          Complete timeline of order status changes and admin decisions
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="text-sm text-red-600 py-4">
            Error loading status history
          </div>
        ) : !activities || activities.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-8">
            No status changes recorded yet
          </div>
        ) : (
          <div className="space-y-4">
            {activities.map((activity: any, index: number) => {
              const config = getActionConfig(activity.action)
              const Icon = config.icon
              const isLast = index === activities.length - 1

              return (
                <div key={activity.id} className="relative">
                  {/* Timeline line */}
                  {!isLast && (
                    <div className="absolute left-[15px] top-8 bottom-0 w-0.5 bg-border" />
                  )}

                  {/* Activity item */}
                  <div className="flex gap-4">
                    {/* Icon */}
                    <div className={`flex-shrink-0 w-8 h-8 rounded-full ${config.color} flex items-center justify-center`}>
                      <Icon className="h-4 w-4" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 pb-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className={config.color}>
                              {config.label}
                            </Badge>
                          </div>

                          {/* Status change info */}
                          {activity.meta?.old_status && activity.meta?.new_status && (
                            <div className="flex items-center gap-2 text-sm mt-2">
                              <Badge variant="outline" className="text-xs">
                                {activity.meta.old_status}
                              </Badge>
                              <span className="text-muted-foreground">→</span>
                              <Badge variant="outline" className="text-xs font-semibold">
                                {activity.meta.new_status}
                              </Badge>
                            </div>
                          )}
                          
                          {/* Admin info */}
                          <div className="text-sm text-muted-foreground">
                            by <span className="font-medium text-foreground">
                              {activity.admin?.full_name || "System"}
                            </span>
                          </div>

                          {/* Admin Note */}
                          {activity.meta?.note && (
                            <div className="text-sm mt-2 p-3 bg-muted rounded-md italic">
                              "{activity.meta.note}"
                            </div>
                          )}

                          {/* Order info */}
                          {activity.meta?.total_price && (
                            <div className="text-xs text-muted-foreground mt-2">
                              Total: Rp {activity.meta.total_price.toLocaleString('id-ID')}
                            </div>
                          )}
                        </div>

                        {/* Timestamp */}
                        <div className="text-xs text-muted-foreground whitespace-nowrap">
                          {format(new Date(activity.created_at), "dd MMM yyyy, HH:mm", { locale: localeId })}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
