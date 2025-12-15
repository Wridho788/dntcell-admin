import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/api/_core/auth'
import { successResponse, errorResponse } from '@/api/_core/response'
import { parseRequestBody } from '@/api/_core/validator'
import { handleApiError } from '@/api/_core/error'
import { logActivity } from '@/api/_core/activity-logger'
import { sendAdminNotification, sendBulkAdminNotification } from '@/lib/onesignal'

// Schema for sending notification - renamed adminId to targetUserId for clarity
const sendNotificationSchema = z.object({
  targetUserId: z.string().uuid().optional(),
  title: z.string().min(1),
  message: z.string().min(1),
  data: z.record(z.string(), z.any()).optional(),
  url: z.string().url().optional(),
  sendToAll: z.boolean().optional().default(false),
})

/**
 * POST /api/onesignal/send
 * Send push notification to user(s) - Admin only
 */
export async function POST(request: NextRequest) {
  try {
    // Require admin authentication
    const authResult = await requireAdmin(request)
    if ('userId' in authResult === false) {
      return authResult // Return error response
    }
    const auth = authResult

    // Validate request body
    const parseResult = await parseRequestBody(request, sendNotificationSchema)
    if (!parseResult.success) {
      return errorResponse(parseResult.error, 422)
    }

    const { targetUserId, title, message, data, url, sendToAll } = parseResult.data

    let result

    if (sendToAll) {
      // Send to all admins
      console.log('[OneSignal Send] Sending to all admins:', { title, message })
      result = await sendBulkAdminNotification(title, message, data, url)
      
      // Log broadcast activity
      await logActivity({
        admin_id: auth.userId,
        action: 'SEND_PUSH_NOTIFICATION_BROADCAST',
        meta: { 
          title,
          message,
          recipients: result.recipients || 0,
          notification_id: result.id,
        },
      })
    } else if (targetUserId) {
      // Send to specific user
      console.log('[OneSignal Send] Sending to user:', { targetUserId, title, message })
      result = await sendAdminNotification(targetUserId, title, message, data, url)
      
      // Log single send activity
      await logActivity({
        admin_id: auth.userId,
        action: 'SEND_PUSH_NOTIFICATION',
        meta: { 
          target_user_id: targetUserId,
          title,
          message,
          notification_id: result.id,
        },
      })
    } else {
      return errorResponse('Either targetUserId or sendToAll must be specified', 400)
    }

    if (!result.success) {
      return errorResponse(result.error || 'Failed to send notification', 500)
    }

    return successResponse(
      {
        sent: true,
        notificationId: result.id,
        recipients: result.recipients,
      },
      'Notification sent successfully'
    )
  } catch (error) {
    console.error('[OneSignal Send] Unexpected error:', error)
    return handleApiError(error)
  }
}
