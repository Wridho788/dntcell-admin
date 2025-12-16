'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Bell,
  BellOff,
  CheckCircle2,
  XCircle,
  MessageSquare,
  ShoppingCart,
  Package,
  AlertCircle,
} from 'lucide-react'
import { api } from '@/lib/api-client'

export default function UserNotificationsPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState<'all' | 'unread'>('all')

  const { data: notifications, isLoading, error } = useQuery({
    queryKey: ['user-notifications', filter],
    queryFn: async () => {
      const result = await api.get<any[]>('/notifications', {
        is_read: filter === 'unread' ? false : undefined,
        page: 1,
        limit: 50,
      })
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to load notifications')
      }
      
      return result.data || []
    },
  })

  const { data: unreadCount } = useQuery({
    queryKey: ['notifications-unread-count'],
    queryFn: async () => {
      const result = await api.get<{ count: number }>('/notifications/unread-count')
      return result.success && result.data ? result.data.count : 0
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  })

  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const result = await api.post(`/notifications/${notificationId}/read`, {})
      if (!result.success) {
        throw new Error('Failed to mark notification as read')
      }
      return result.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-notifications'] })
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] })
    },
  })

  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      const result = await api.post('/notifications/read-all', {})
      if (!result.success) {
        throw new Error('Failed to mark all as read')
      }
      return result.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-notifications'] })
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] })
    },
  })

  const handleNotificationClick = (notification: any) => {
    // Mark as read
    if (!notification.is_read) {
      markAsReadMutation.mutate(notification.id)
    }

    // Navigate based on type
    if (notification.negotiation_id) {
      router.push('/user/negotiations')
    } else if (notification.order_id) {
      router.push(`/user/orders/${notification.order_id}`)
    }
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'negotiation_approved':
      case 'negotiation_counter':
        return <MessageSquare className="h-5 w-5" />
      case 'negotiation_rejected':
        return <XCircle className="h-5 w-5" />
      case 'order_created':
      case 'order_status_updated':
        return <ShoppingCart className="h-5 w-5" />
      case 'payment_status_updated':
        return <Package className="h-5 w-5" />
      default:
        return <Bell className="h-5 w-5" />
    }
  }

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'negotiation_approved':
        return 'bg-green-100 text-green-800'
      case 'negotiation_rejected':
        return 'bg-red-100 text-red-800'
      case 'negotiation_counter':
        return 'bg-blue-100 text-blue-800'
      case 'order_created':
        return 'bg-purple-100 text-purple-800'
      case 'order_status_updated':
        return 'bg-indigo-100 text-indigo-800'
      case 'payment_status_updated':
        return 'bg-amber-100 text-amber-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Baru saja'
    if (diffMins < 60) return `${diffMins} menit lalu`
    if (diffHours < 24) return `${diffHours} jam lalu`
    if (diffDays < 7) return `${diffDays} hari lalu`
    return date.toLocaleDateString('id-ID', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const filteredNotifications = notifications || []
  const hasUnread = filteredNotifications.some((n) => !n.is_read)

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Bell className="h-8 w-8 text-primary" />
              <div>
                <h1 className="text-3xl font-bold">Notifications</h1>
                {unreadCount !== undefined && unreadCount > 0 && (
                  <p className="text-sm text-muted-foreground">
                    You have {unreadCount} unread notification{unreadCount > 1 ? 's' : ''}
                  </p>
                )}
              </div>
            </div>
            
            {hasUnread && (
              <Button
                variant="outline"
                onClick={() => markAllAsReadMutation.mutate()}
                disabled={markAllAsReadMutation.isPending}
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Mark All as Read
              </Button>
            )}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total</p>
                    <p className="text-2xl font-bold">{filteredNotifications.length}</p>
                  </div>
                  <Bell className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Unread</p>
                    <p className="text-2xl font-bold">
                      {unreadCount || 0}
                    </p>
                  </div>
                  <Badge className="h-8 px-3 bg-blue-100 text-blue-800">
                    {unreadCount || 0}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filter Buttons */}
          <div className="flex gap-2 mt-4">
            <Button
              variant={filter === 'all' ? 'default' : 'outline'}
              onClick={() => setFilter('all')}
            >
              All
            </Button>
            <Button
              variant={filter === 'unread' ? 'default' : 'outline'}
              onClick={() => setFilter('unread')}
            >
              Unread
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8">
        {/* Loading State */}
        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <div className="flex gap-3">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
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
              <h3 className="text-lg font-semibold mb-2">Failed to Load Notifications</h3>
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
        {!isLoading && !error && filteredNotifications.length === 0 && (
          <Card className="p-12">
            <div className="text-center">
              <BellOff className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">
                {filter === 'unread' ? 'No Unread Notifications' : 'No Notifications'}
              </h3>
              <p className="text-muted-foreground">
                {filter === 'unread'
                  ? "You're all caught up!"
                  : 'Notifications will appear here when you have activity'}
              </p>
            </div>
          </Card>
        )}

        {/* Notifications List */}
        {!isLoading && !error && filteredNotifications.length > 0 && (
          <div className="space-y-3">
            {filteredNotifications.map((notification) => (
              <Card
                key={notification.id}
                className={`cursor-pointer hover:shadow-md transition-all ${
                  !notification.is_read ? 'bg-blue-50 border-blue-200' : ''
                }`}
                onClick={() => handleNotificationClick(notification)}
              >
                <CardContent className="p-4">
                  <div className="flex gap-4">
                    {/* Icon */}
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${getNotificationColor(
                        notification.type
                      )}`}
                    >
                      {getNotificationIcon(notification.type)}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <p
                          className={`text-sm ${
                            !notification.is_read ? 'font-semibold' : 'font-normal'
                          }`}
                        >
                          {notification.title}
                        </p>
                        {!notification.is_read && (
                          <div className="shrink-0 h-2 w-2 rounded-full bg-blue-600" />
                        )}
                      </div>
                      
                      <p className="text-sm text-muted-foreground mb-2">
                        {notification.message}
                      </p>
                      
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{formatRelativeTime(notification.created_at)}</span>
                        {notification.type && (
                          <>
                            <span>•</span>
                            <Badge variant="outline" className="text-xs capitalize">
                              {notification.type.replace('_', ' ')}
                            </Badge>
                          </>
                        )}
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
