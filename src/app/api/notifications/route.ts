import { NextRequest } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/api/_core/supabase-server'
import { requireAuth } from '@/api/_core/auth'
import { successResponse, errorResponse, unauthorizedResponse } from '@/api/_core/response'
import { parseRequestBody } from '@/api/_core/validator'
import { handleApiError } from '@/api/_core/error'
import { logActivity } from '@/api/_core/activity-logger'

// GET /api/notifications - List user notifications
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (!auth) {
      return unauthorizedResponse()
    }

    const { searchParams } = new URL(request.url)
    
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const unreadOnly = searchParams.get('unread') === 'true'

    let query = supabaseAdmin
      .from('notifications')
      .select('id, user_id, type, title, message, data, read_at, created_at', { count: 'exact' })
      .eq('user_id', auth.userId)

    if (unreadOnly) {
      query = query.is('read_at', null)
    }

    // Pagination
    const from = (page - 1) * limit
    const to = from + limit - 1

    query = query
      .order('created_at', { ascending: false })
      .range(from, to)

    const { data, error, count } = await query

    if (error) {
      return errorResponse(error.message)
    }

    return successResponse({
      notifications: data,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}

// POST /api/notifications/send - Send notification (admin only)
const sendNotificationSchema = z.object({
  user_ids: z.array(z.string().uuid()).min(1, 'At least one user ID is required'),
  type: z.enum(['new_negotiation', 'negotiation_approved', 'negotiation_rejected', 'negotiation_countered', 'new_order', 'order_status_updated', 'system_message']),
  title: z.string().min(1),
  message: z.string().min(1),
  data: z.record(z.string(), z.any()).optional(),
})

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (!auth) {
      return unauthorizedResponse()
    }

    if (!auth.isAdmin) {
      return errorResponse('Admin access required', 403)
    }

    const validation = await parseRequestBody(request, sendNotificationSchema)
    if (!validation.success) {
      return errorResponse(validation.error, 422)
    }

    const { user_ids, type, title, message, data } = validation.data

    // Prepare bulk insert payload
    const payload = user_ids.map(userId => ({
      user_id: userId,
      type,
      title,
      message,
      data: data || {},
    }))

    // Insert notifications in bulk
    const { data: notifications, error: insertError } = await supabaseAdmin
      .from('notifications')
      .insert(payload)
      .select()

    if (insertError) {
      return errorResponse(insertError.message)
    }

    // Log activity for audit trail
    await logActivity({
      admin_id: auth.userId,
      action: 'SEND_NOTIFICATION',
      meta: {
        type,
        title,
        recipient_count: user_ids.length,
        user_ids: user_ids,
      },
    })

    // TODO: Trigger OneSignal push notification to all users

    return successResponse(
      {
        notifications,
        sent_count: notifications?.length || 0,
      },
      `${notifications?.length || 0} notification(s) sent successfully`,
      201
    )
  } catch (error) {
    return handleApiError(error)
  }
}
