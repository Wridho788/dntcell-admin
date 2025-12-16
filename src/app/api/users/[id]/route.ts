import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/api/_core/supabase-server'
import { requireAdmin } from '@/api/_core/auth'
import { successResponse, errorResponse, notFoundResponse } from '@/api/_core/response'
import { handleApiError } from '@/api/_core/error'

// GET /api/users/[id] - Get user detail
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAdmin(request)
    if ('userId' in auth === false) {
      return auth // Return error response
    }

    // Fetch user profile with counts
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select(`
        user_id,
        full_name,
        email,
        phone,
        role,
        is_active,
        created_at
      `)
      .eq('user_id', params.id)
      .single()

    if (profileError || !profile) {
      return notFoundResponse('User not found')
    }

    // Get order count
    const { count: orderCount } = await supabaseAdmin
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('buyer_id', params.id)

    // Get negotiation count
    const { count: negotiationCount } = await supabaseAdmin
      .from('negotiations')
      .select('*', { count: 'exact', head: true })
      .eq('buyer_id', params.id)

    const userData = {
      ...profile,
      _count: {
        orders: orderCount || 0,
        negotiations: negotiationCount || 0,
      },
    }

    return successResponse(userData)
  } catch (error) {
    return handleApiError(error)
  }
}
