"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { AdminLayout } from "@/components/layout"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { LoadingCard } from "@/components/ui/loading"
import { toast } from "sonner"
import Link from "next/link"
import {
  Bell,
  BellOff,
  Check,
  CheckCheck,
  Package,
  MessageSquare,
  ShoppingCart,
  AlertCircle,
} from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type NotificationType =
  | "new_negotiation"
  | "negotiation_approved"
  | "negotiation_rejected"
  | "negotiation_countered"
  | "new_order"
  | "order_status_updated"
  | "order_payment_updated"
  | "system_message"

type Notification = {
  id: string
  user_id: string
  type: NotificationType
  title: string
  message: string
  data: Record<string, any>
  read_at: string | null
  created_at: string
}

const notificationIcons: Record<NotificationType, React.ReactNode> = {
  new_negotiation: <MessageSquare className="h-5 w-5 text-blue-600" />,
  negotiation_approved: <Check className="h-5 w-5 text-green-600" />,
  negotiation_rejected: <AlertCircle className="h-5 w-5 text-red-600" />,
  negotiation_countered: <MessageSquare className="h-5 w-5 text-yellow-600" />,
  new_order: <ShoppingCart className="h-5 w-5 text-purple-600" />,
  order_status_updated: <Package className="h-5 w-5 text-blue-600" />,
  order_payment_updated: <Package className="h-5 w-5 text-green-600" />,
  system_message: <Bell className="h-5 w-5 text-gray-600" />,
}

export function NotificationsClient() {
  const queryClient = useQueryClient()
  const [typeFilter, setTypeFilter] = useState<NotificationType | "all">("all")
  const [statusFilter, setStatusFilter] = useState<"all" | "read" | "unread">("all")
  const [page, setPage] = useState(1)
  const limit = 20

  const { data, isLoading, error } = useQuery({
    queryKey: ["notifications", { page, limit, type: typeFilter, status: statusFilter }],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      })

      if (typeFilter && typeFilter !== "all") params.append("type", typeFilter)
      if (statusFilter === "read") params.append("read", "true")
      if (statusFilter === "unread") params.append("read", "false")

      const response = await fetch(`/api/notifications?${params}`)
      if (!response.ok) {
        throw new Error("Failed to fetch notifications")
      }
      const result = await response.json()
      return result.data
    },
    staleTime: 10000,
  })

  const { data: unreadCount } = useQuery({
    queryKey: ["notifications-unread-count"],
    queryFn: async () => {
      const response = await fetch("/api/notifications/unread-count")
      if (!response.ok) throw new Error("Failed to fetch unread count")
      const result = await response.json()
      return result.data.unread_count
    },
    staleTime: 10000,
  })

  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const response = await fetch(`/api/notifications/${notificationId}/read`, {
        method: "PATCH",
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to mark as read")
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] })
      queryClient.invalidateQueries({ queryKey: ["notifications-unread-count"] })
    },
    onError: (error: Error) => {
      toast.error(`Failed: ${error.message}`)
    },
  })

  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/notifications/read-all", {
        method: "POST",
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to mark all as read")
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] })
      queryClient.invalidateQueries({ queryKey: ["notifications-unread-count"] })
      toast.success("Semua notifikasi ditandai sebagai dibaca")
    },
    onError: (error: Error) => {
      toast.error(`Gagal: ${error.message}`)
    },
  })

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.read_at) {
      markAsReadMutation.mutate(notification.id)
    }

    // Redirect based on notification type
    if (notification.data?.negotiation_id) {
      window.location.href = `/negotiations/${notification.data.negotiation_id}`
    } else if (notification.data?.order_id) {
      window.location.href = `/orders/${notification.data.order_id}`
    }
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString("id-ID", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const formatRelativeTime = (date: string) => {
    const now = new Date()
    const notifDate = new Date(date)
    const diffMs = now.getTime() - notifDate.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return "Baru saja"
    if (diffMins < 60) return `${diffMins} menit lalu`
    if (diffHours < 24) return `${diffHours} jam lalu`
    if (diffDays < 7) return `${diffDays} hari lalu`
    return formatDate(date)
  }

  const totalPages = data ? Math.ceil(data.total / limit) : 0

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="space-y-6 mx-4">
          <LoadingCard />
        </div>
      </AdminLayout>
    )
  }

  if (error) {
    return (
      <AdminLayout>
        <div className="space-y-6 mx-4">
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-red-500">
                Error loading notifications: {error instanceof Error ? error.message : "Unknown error"}
              </p>
            </CardContent>
          </Card>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      <div className="space-y-6 mx-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Notifikasi</h1>
            <p className="text-muted-foreground">
              Kelola notifikasi dan update sistem
            </p>
          </div>

          {unreadCount > 0 && (
            <Button
              variant="outline"
              onClick={() => markAllAsReadMutation.mutate()}
              disabled={markAllAsReadMutation.isPending}
            >
              <CheckCheck className="mr-2 h-4 w-4" />
              Tandai Semua Dibaca
            </Button>
          )}
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Notifikasi</CardTitle>
              <Bell className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data?.total || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Belum Dibaca</CardTitle>
              <BellOff className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{unreadCount || 0}</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Filter</CardTitle>
            <CardDescription>Filter notifikasi berdasarkan tipe dan status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <label className="text-sm font-medium mb-2 block">Tipe Notifikasi</label>
                <Select
                  value={typeFilter}
                  onValueChange={(value) => {
                    setTypeFilter(value as NotificationType | "all")
                    setPage(1)
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Semua tipe" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Tipe</SelectItem>
                    <SelectItem value="new_negotiation">Negosiasi Baru</SelectItem>
                    <SelectItem value="negotiation_approved">Negosiasi Disetujui</SelectItem>
                    <SelectItem value="negotiation_rejected">Negosiasi Ditolak</SelectItem>
                    <SelectItem value="negotiation_countered">Tawaran Balik</SelectItem>
                    <SelectItem value="new_order">Pesanan Baru</SelectItem>
                    <SelectItem value="order_status_updated">Status Pesanan</SelectItem>
                    <SelectItem value="system_message">Pesan Sistem</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex-1 min-w-[200px]">
                <label className="text-sm font-medium mb-2 block">Status</label>
                <Select
                  value={statusFilter}
                  onValueChange={(value) => {
                    setStatusFilter(value as "all" | "read" | "unread")
                    setPage(1)
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Semua status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Status</SelectItem>
                    <SelectItem value="unread">Belum Dibaca</SelectItem>
                    <SelectItem value="read">Sudah Dibaca</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notifications List */}
        <Card>
          <CardHeader>
            <CardTitle>Daftar Notifikasi</CardTitle>
            <CardDescription>
              {data?.total || 0} notifikasi
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {!data?.notifications || data.notifications.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  <BellOff className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Tidak ada notifikasi</p>
                </div>
              ) : (
                data.notifications.map((notification: Notification) => (
                  <div
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={`
                      flex items-start gap-4 p-4 rounded-lg border cursor-pointer
                      transition-colors hover:bg-muted/50
                      ${!notification.read_at ? "bg-blue-50 border-blue-200" : "bg-white"}
                    `}
                  >
                    {/* Icon */}
                    <div className="shrink-0 mt-1">
                      {notificationIcons[notification.type]}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <p className="font-medium text-sm">
                            {notification.title}
                            {!notification.read_at && (
                              <Badge variant="default" className="ml-2 bg-blue-600 text-xs">
                                Baru
                              </Badge>
                            )}
                          </p>
                          <p className="text-sm text-muted-foreground mt-1">
                            {notification.message}
                          </p>
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatRelativeTime(notification.created_at)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-6">
                <p className="text-sm text-muted-foreground">
                  Halaman {page} dari {totalPages}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    Sebelumnya
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    Selanjutnya
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  )
}
