import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/api/_core/supabase-server'
import { requireAuth } from '@/api/_core/auth'
import { successResponse, errorResponse, unauthorizedResponse } from '@/api/_core/response'
import { handleApiError } from '@/api/_core/error'

// PATCH /api/notifications/read-all - Mark all notifications as read
export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (!auth) {
      return unauthorizedResponse()
    }

    // Mark all unread notifications as read for this user
    const { data, error } = await supabaseAdmin
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', auth.userId)
      .is('read_at', null)
      .select()

    if (error) {
      return errorResponse(error.message)
    }

    const updatedCount = data?.length || 0

    return successResponse(
      { 
        updated_count: updatedCount,
        message: `${updatedCount} notification(s) marked as read`
      },
      `Successfully marked ${updatedCount} notification(s) as read`
    )
  } catch (error) {
    return handleApiError(error)
  }
}
