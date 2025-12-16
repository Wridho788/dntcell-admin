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

    // SECURITY: Whitelist explicit fields - never expose internal/sensitive fields
    // Only return what the user needs for UI
    // Future-proof: Add fields explicitly when needed (is_verified, last_login_at)
    const { data: user, error } = await supabaseAdmin
      .from('profiles')
      .select(`
        user_id,
        full_name,
        email,
        phone,
        role,
        onesignal_player_id,
        is_active,
        created_at
      `)
      .eq('user_id', auth.userId)
      .single()

    if (error || !user) {
      // TODO: Add fallback to auth.users table if profile doesn't exist
      // This ensures consistency between Supabase Auth and profiles table
      // Recommendation: Create profile auto-creation trigger on auth.users insert
      return errorResponse(error?.message || 'Profile not found', 404)
    }

    // Standardized response shape: use 'user' for consistency
    return successResponse({
      user,
      isAdmin: auth.isAdmin,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
