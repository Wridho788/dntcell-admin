import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/api/_core/auth'
import { successResponse, errorResponse } from '@/api/_core/response'
import { parseRequestBody } from '@/api/_core/validator'
import { handleApiError } from '@/api/_core/error'
import { sendAdminNotification, sendBulkAdminNotification } from '@/lib/onesignal'

// Schema for sending notification
const sendNotificationSchema = z.object({
  adminId: z.string().uuid().optional(),
  title: z.string().min(1),
  message: z.string().min(1),
  data: z.record(z.string(), z.any()).optional(),
  url: z.string().url().optional(),
  sendToAll: z.boolean().optional().default(false),
})

/**
 * POST /api/onesignal/send
 * Send push notification to admin(s) - Admin only
 */
export async function POST(request: NextRequest) {
  try {
    // Require admin authentication
    const authResult = await requireAdmin(request)
    if ('userId' in authResult === false) {
      return authResult // Return error response
    }

    // Validate request body
    const parseResult = await parseRequestBody(request, sendNotificationSchema)
    if (!parseResult.success) {
      return errorResponse(parseResult.error, 422)
    }

    const { adminId, title, message, data, url, sendToAll } = parseResult.data

    let result

    if (sendToAll) {
      // Send to all admins
      console.log('[OneSignal Send] Sending to all admins:', { title, message })
      result = await sendBulkAdminNotification(title, message, data, url)
    } else if (adminId) {
      // Send to specific admin
      console.log('[OneSignal Send] Sending to admin:', { adminId, title, message })
      result = await sendAdminNotification(adminId, title, message, data, url)
    } else {
      return errorResponse('Either adminId or sendToAll must be specified', 400)
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
