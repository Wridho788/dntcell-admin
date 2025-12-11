import { NextRequest } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/api/_core/supabase-server'
import { requireAuth } from '@/api/_core/auth'
import { successResponse, errorResponse, unauthorizedResponse } from '@/api/_core/response'
import { parseRequestBody } from '@/api/_core/validator'
import { handleApiError } from '@/api/_core/error'

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
      .select('*', { count: 'exact' })
      .eq('user_id', auth.userId)

    if (unreadOnly) {
      query = query.eq('read', false)
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
  user_id: z.string().uuid(),
  type: z.enum(['new_negotiation', 'negotiation_approved', 'negotiation_rejected', 'new_order', 'order_status_updated', 'system_message']),
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

    // Insert notification
    const { data: notification, error: insertError } = await supabaseAdmin
      .from('notifications')
      .insert(validation.data)
      .select()
      .single()

    if (insertError) {
      return errorResponse(insertError.message)
    }

    // TODO: Trigger OneSignal push notification

    return successResponse(notification, 'Notification sent successfully', 201)
  } catch (error) {
    return handleApiError(error)
  }
}
