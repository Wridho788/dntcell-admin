import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/api/_core/supabase-server'
import { requireAuth } from '@/api/_core/auth'
import { successResponse, errorResponse, unauthorizedResponse } from '@/api/_core/response'
import { handleApiError } from '@/api/_core/error'

// GET /api/users/me - Get current user profile
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (!auth) {
      return unauthorizedResponse()
    }

    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('user_id', auth.userId)
      .single()

    if (error || !profile) {
      return errorResponse(error?.message || 'Profile not found')
    }

    return successResponse({
      profile,
      isAdmin: auth.isAdmin,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
