"use client"

import { useState } from "react"
import { AdminLayout } from "@/components/layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useActivityLogs } from "@/hooks/useActivityLogs"
import { format } from "date-fns"
import { id as localeId } from "date-fns/locale"
import { Loader2, Search, Filter, FileText, ShoppingCart, Package, DollarSign, XCircle, CheckCircle } from "lucide-react"

// Action type configuration
const ACTION_CONFIG = {
  // Negotiation actions
  NEGOTIATION_REQUESTED: { 
    label: "Negotiation Requested", 
    color: "bg-blue-500/10 text-blue-700 border-blue-200",
    icon: DollarSign 
  },
  NEGOTIATION_APPROVED: { 
    label: "Negotiation Approved", 
    color: "bg-green-500/10 text-green-700 border-green-200",
    icon: CheckCircle 
  },
  NEGOTIATION_COUNTERED: { 
    label: "Counter Offer Sent", 
    color: "bg-yellow-500/10 text-yellow-700 border-yellow-200",
    icon: DollarSign 
  },
  NEGOTIATION_REJECTED: { 
    label: "Negotiation Rejected", 
    color: "bg-red-500/10 text-red-700 border-red-200",
    icon: XCircle 
  },
  
  // Order actions
  ORDER_CREATED: { 
    label: "Order Created", 
    color: "bg-blue-500/10 text-blue-700 border-blue-200",
    icon: ShoppingCart 
  },
  ORDER_PAID: { 
    label: "Order Paid", 
    color: "bg-green-500/10 text-green-700 border-green-200",
    icon: CheckCircle 
  },
  ORDER_SHIPPED: { 
    label: "Order Shipped", 
    color: "bg-purple-500/10 text-purple-700 border-purple-200",
    icon: Package 
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
    label: "Order Status Changed", 
    color: "bg-yellow-500/10 text-yellow-700 border-yellow-200",
    icon: ShoppingCart 
  },
  
  // Product actions
  PRODUCT_PRICE_ADJUSTED: { 
    label: "Product Price Adjusted", 
    color: "bg-blue-500/10 text-blue-700 border-blue-200",
    icon: DollarSign 
  },
  PRODUCT_REJECTED: { 
    label: "Product Rejected", 
    color: "bg-red-500/10 text-red-700 border-red-200",
    icon: XCircle 
  },
  PRODUCT_ACTIVATED: { 
    label: "Product Activated", 
    color: "bg-green-500/10 text-green-700 border-green-200",
    icon: CheckCircle 
  },
  PRODUCT_CREATED: { 
    label: "Product Created", 
    color: "bg-blue-500/10 text-blue-700 border-blue-200",
    icon: Package 
  },
  PRODUCT_UPDATED: { 
    label: "Product Updated", 
    color: "bg-yellow-500/10 text-yellow-700 border-yellow-200",
    icon: Package 
  },
  PRODUCT_DELETED: { 
    label: "Product Deleted", 
    color: "bg-red-500/10 text-red-700 border-red-200",
    icon: XCircle 
  },
  
  // Default
  DEFAULT: { 
    label: "Unknown Action", 
    color: "bg-gray-500/10 text-gray-700 border-gray-200",
    icon: FileText 
  },
} as const

type ActionType = keyof typeof ACTION_CONFIG

function getActionConfig(action: string) {
  return ACTION_CONFIG[action as ActionType] || ACTION_CONFIG.DEFAULT
}

export function ActivityLogsClient() {
  const [actionFilter, setActionFilter] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [page, setPage] = useState(1)

  const { data: logs, isLoading, error } = useActivityLogs({
    action: actionFilter === "all" ? undefined : actionFilter,
    page,
    limit: 50,
  })

  const filteredLogs = logs?.filter(log => {
    if (!searchQuery) return true
    const searchLower = searchQuery.toLowerCase()
    return (
      log.action.toLowerCase().includes(searchLower) ||
      log.admin?.full_name?.toLowerCase().includes(searchLower) ||
      JSON.stringify(log.meta).toLowerCase().includes(searchLower)
    )
  })

  // Get unique actions for filter
  const availableActions = logs 
    ? Array.from(new Set(logs.map(log => log.action)))
    : []

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Activity Logs</h1>
          <p className="text-muted-foreground mt-2">
            Internal audit trail and admin accountability logs
          </p>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by action, admin, or details..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              {/* Action Filter */}
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by action" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  {availableActions.map((action) => (
                    <SelectItem key={action} value={action}>
                      {getActionConfig(action).label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Activity Table */}
        <Card>
          <CardHeader>
            <CardTitle>Activity History</CardTitle>
            <CardDescription>
              Complete audit trail of all admin actions
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : error ? (
              <div className="text-center py-8 text-red-600">
                Error loading activity logs: {error.message}
              </div>
            ) : !filteredLogs || filteredLogs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No activity logs found
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[180px]">Timestamp</TableHead>
                      <TableHead className="w-[150px]">Admin</TableHead>
                      <TableHead className="w-[200px]">Action</TableHead>
                      <TableHead>Object</TableHead>
                      <TableHead>Context</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLogs.map((log) => {
                      const config = getActionConfig(log.action)
                      const Icon = config.icon
                      
                      return (
                        <TableRow key={log.id}>
                          <TableCell className="font-mono text-sm">
                            {format(new Date(log.created_at), "dd MMM yyyy, HH:mm", { locale: localeId })}
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">
                              {log.admin?.full_name || "System"}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`${config.color} flex items-center gap-1 w-fit`}>
                              <Icon className="h-3 w-3" />
                              {config.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {log.meta?.product_id && (
                              <div className="text-sm">
                                <span className="text-muted-foreground">Product:</span>{" "}
                                <span className="font-medium">{log.meta.product_name || log.meta.product_id}</span>
                              </div>
                            )}
                            {log.meta?.negotiation_id && (
                              <div className="text-sm">
                                <span className="text-muted-foreground">Negotiation:</span>{" "}
                                <span className="font-medium">#{log.meta.negotiation_id.slice(0, 8)}</span>
                              </div>
                            )}
                            {log.meta?.order_id && (
                              <div className="text-sm">
                                <span className="text-muted-foreground">Order:</span>{" "}
                                <span className="font-medium">#{log.meta.order_id.slice(0, 8)}</span>
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1 text-sm">
                              {log.meta?.note && (
                                <div className="text-muted-foreground italic">"{log.meta.note}"</div>
                              )}
                              {log.meta?.pricing_snapshot && (
                                <div className="text-xs text-muted-foreground">
                                  Price: Rp {log.meta.pricing_snapshot.selling_price?.toLocaleString('id-ID')}
                                </div>
                              )}
                              {log.meta?.old_status && log.meta?.new_status && (
                                <div className="text-xs">
                                  <span className="text-muted-foreground">Status:</span>{" "}
                                  <span className="line-through text-red-600">{log.meta.old_status}</span>
                                  {" → "}
                                  <span className="text-green-600">{log.meta.new_status}</span>
                                </div>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  )
}
