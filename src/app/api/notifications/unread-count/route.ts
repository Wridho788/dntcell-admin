import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/api/_core/supabase-server'
import { requireAuth } from '@/api/_core/auth'
import { successResponse, errorResponse, unauthorizedResponse } from '@/api/_core/response'
import { handleApiError } from '@/api/_core/error'

// GET /api/notifications/unread-count - Get unread notification count
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (!auth) {
      return unauthorizedResponse()
    }

    // Count unread notifications (where read_at IS NULL)
    const { count, error } = await supabaseAdmin
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', auth.userId)
      .is('read_at', null)

    if (error) {
      return errorResponse(error.message)
    }

    return successResponse({
      unread_count: count || 0,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
