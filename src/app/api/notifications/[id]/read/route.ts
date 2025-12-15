import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/api/_core/supabase-server'
import { requireAuth } from '@/api/_core/auth'
import { successResponse, errorResponse, notFoundResponse, unauthorizedResponse } from '@/api/_core/response'
import { handleApiError } from '@/api/_core/error'

// PATCH /api/notifications/[id]/read - Mark notification as read
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAuth(request)
    if (!auth) {
      return unauthorizedResponse()
    }

    // Get notification and verify ownership
    const { data: notification, error: fetchError } = await supabaseAdmin
      .from('notifications')
      .select('id, user_id, read_at')
      .eq('id', params.id)
      .single()

    if (fetchError || !notification) {
      return notFoundResponse('Notification not found')
    }

    // Verify user owns this notification
    if (notification.user_id !== auth.userId) {
      return errorResponse('You can only mark your own notifications as read', 403)
    }

    // Check if already read
    if (notification.read_at) {
      return successResponse(notification, 'Notification already marked as read')
    }

    // Mark as read
    const { data: updated, error: updateError } = await supabaseAdmin
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', params.id)
      .select('id, user_id, type, title, message, data, read_at, created_at')
      .single()

    if (updateError) {
      return errorResponse(updateError.message)
    }

    return successResponse(updated, 'Notification marked as read')
  } catch (error) {
    return handleApiError(error)
  }
}
