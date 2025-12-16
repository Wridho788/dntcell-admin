/**
 * Centralized Notification System
 * Ensures database insert AND push notification happen together
 * OneSignal is NOT source of truth - notifications table is
 */

import { supabaseAdmin } from '@/api/_core/supabase-server'
import { sendPushNotification, sendUserNotification as sendPushToUser } from '@/lib/onesignal'

export type NotificationType =
  | 'new_negotiation'
  | 'negotiation_approved'
  | 'negotiation_rejected'
  | 'negotiation_countered'
  | 'new_order'
  | 'order_status_updated'
  | 'order_payment_updated'
  | 'system_message'

interface NotificationParams {
  userId: string
  type: NotificationType
  title: string
  message: string
  data?: Record<string, any>
  url?: string
}

interface BulkNotificationParams {
  userIds: string[]
  type: NotificationType
  title: string
  message: string
  data?: Record<string, any>
  url?: string
}

/**
 * Send notification to single user
 * 1. Insert to notifications table (source of truth)
 * 2. Send push via OneSignal (best effort)
 */
export async function sendUserNotification(
  params: NotificationParams
): Promise<{ success: boolean; notificationId?: string; error?: string }> {
  try {
    const { userId, type, title, message, data, url } = params

    // Step 1: Insert to database (source of truth)
    const { data: notification, error: insertError } = await supabaseAdmin
      .from('notifications')
      .insert({
        user_id: userId,
        type,
        title,
        message,
        data: data || {},
      })
      .select('id')
      .single()

    if (insertError || !notification) {
      console.error('[NotificationHelper] DB insert error:', insertError)
      return {
        success: false,
        error: 'Failed to create notification in database',
      }
    }

    // Step 2: Send push notification (best effort - don't fail if this fails)
    try {
      await sendPushToUser(userId, title, message, data, url)
      console.log('[NotificationHelper] Push sent successfully for notification:', notification.id)
    } catch (pushError) {
      console.error('[NotificationHelper] Push failed (DB record exists):', pushError)
      // Don't fail - notification is saved in DB
    }

    return {
      success: true,
      notificationId: notification.id,
    }
  } catch (error) {
    console.error('[NotificationHelper] Unexpected error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Send notification to multiple users
 * 1. Bulk insert to notifications table
 * 2. Send push via OneSignal (best effort)
 */
export async function sendBulkNotification(
  params: BulkNotificationParams
): Promise<{ success: boolean; count?: number; error?: string }> {
  try {
    const { userIds, type, title, message, data, url } = params

    if (!userIds || userIds.length === 0) {
      return { success: false, error: 'No user IDs provided' }
    }

    // Step 1: Bulk insert to database
    const notifications = userIds.map((userId) => ({
      user_id: userId,
      type,
      title,
      message,
      data: data || {},
    }))

    const { data: inserted, error: insertError } = await supabaseAdmin
      .from('notifications')
      .insert(notifications)
      .select('id')

    if (insertError) {
      console.error('[NotificationHelper] Bulk insert error:', insertError)
      return {
        success: false,
        error: 'Failed to create notifications in database',
      }
    }

    // Step 2: Get player IDs for push notification
    const { data: profiles, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('onesignal_player_id')
      .in('user_id', userIds)
      .not('onesignal_player_id', 'is', null)

    if (!profileError && profiles && profiles.length > 0) {
      const playerIds = profiles
        .map((p) => p.onesignal_player_id)
        .filter((id): id is string => !!id)

      if (playerIds.length > 0) {
        try {
          await sendPushNotification({
            playerIds,
            title,
            message,
            data,
            url,
          })
          console.log('[NotificationHelper] Bulk push sent to', playerIds.length, 'users')
        } catch (pushError) {
          console.error('[NotificationHelper] Bulk push failed (DB records exist):', pushError)
          // Don't fail - notifications are saved in DB
        }
      }
    }

    return {
      success: true,
      count: inserted?.length || 0,
    }
  } catch (error) {
    console.error('[NotificationHelper] Unexpected error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Send notification to all admins
 * Convenience wrapper for sendBulkNotification
 */
export async function sendAdminNotification(
  params: Omit<BulkNotificationParams, 'userIds'>
): Promise<{ success: boolean; count?: number; error?: string }> {
  try {
    // Get all admin user IDs
    const { data: admins, error } = await supabaseAdmin
      .from('profiles')
      .select('user_id')
      .eq('role', 'admin')

    if (error || !admins || admins.length === 0) {
      console.warn('[NotificationHelper] No admins found')
      return {
        success: false,
        error: 'No admins available for notification',
      }
    }

    const adminIds = admins.map((a) => a.user_id)

    return sendBulkNotification({
      ...params,
      userIds: adminIds,
    })
  } catch (error) {
    console.error('[NotificationHelper] sendAdminNotification error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
