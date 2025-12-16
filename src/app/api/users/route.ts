import { NextRequest } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/api/_core/supabase-server'
import { requireAdmin } from '@/api/_core/auth'
import { successResponse, errorResponse } from '@/api/_core/response'
import { handleApiError } from '@/api/_core/error'
import { logActivity } from '@/api/_core/activity-logger'

// GET /api/users - List all users (admin only)
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdmin(request)
    if ('userId' in authResult === false) {
      return authResult // Return error response
    }
    const auth = authResult

    const { searchParams } = new URL(request.url)
    
    const role = searchParams.get('role')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    // SECURITY: Whitelist explicit fields only - never use select('*')
    // Future-proof: Add fields here explicitly when needed (is_suspended, is_verified, last_login_at)
    let query = supabaseAdmin
      .from('profiles')
      .select(`
        user_id,
        full_name,
        email,
        role,
        created_at,
        updated_at
      `, { count: 'exact' })

    // TODO: Migrate to user_roles table for proper RBAC
    // Current: using profiles.role (temporary)
    // Future: JOIN to user_roles table for multi-role support
    if (role) {
      query = query.eq('role', role)
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

    // Audit trail for sensitive admin operation
    await logActivity({
      admin_id: auth.userId,
      action: 'VIEW_USERS',
      meta: { 
        role: role || 'all',
        page,
        limit,
        total_viewed: data?.length || 0,
      },
    })

    return successResponse({
      users: data,
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
