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
    const status = searchParams.get('status')
    const search = searchParams.get('search')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    // SECURITY: Whitelist explicit fields only - never use select('*')
    let query = supabaseAdmin
      .from('profiles')
      .select(`
        user_id,
        full_name,
        email,
        phone,
        role,
        is_active,
        created_at,
        updated_at
      `, { count: 'exact' })

    // Apply filters
    if (role && role !== 'all') {
      query = query.eq('role', role)
    }

    if (status && status !== 'all') {
      const isActive = status === 'active'
      query = query.eq('is_active', isActive)
    }

    // Search by name or email (in-memory filtering due to join limitations)
    const from = (page - 1) * limit
    const to = from + limit - 1

    query = query.order('created_at', { ascending: false })

    // If search, fetch more for filtering
    if (search && search.trim()) {
      query = query.range(0, 999)
    } else {
      query = query.range(from, to)
    }

    const { data, error, count } = await query

    if (error) {
      return errorResponse(error.message)
    }

    // Client-side filtering for search
    let filteredData = data || []
    let filteredCount = count || 0

    if (search && search.trim()) {
      const searchLower = search.toLowerCase()
      filteredData = filteredData.filter((user) => {
        const matchesName = user.full_name?.toLowerCase().includes(searchLower)
        const matchesEmail = user.email?.toLowerCase().includes(searchLower)
        return matchesName || matchesEmail
      })
      filteredCount = filteredData.length
      filteredData = filteredData.slice(from, to + 1)
    }

    // Get counts for each user (orders and negotiations)
    const usersWithCounts = await Promise.all(
      filteredData.map(async (user) => {
        const [{ count: orderCount }, { count: negotiationCount }] = await Promise.all([
          supabaseAdmin
            .from('orders')
            .select('*', { count: 'exact', head: true })
            .eq('buyer_id', user.user_id),
          supabaseAdmin
            .from('negotiations')
            .select('*', { count: 'exact', head: true })
            .eq('buyer_id', user.user_id),
        ])

        return {
          ...user,
          _count: {
            orders: orderCount || 0,
            negotiations: negotiationCount || 0,
          },
        }
      })
    )

    // Audit trail for sensitive admin operation
    await logActivity({
      admin_id: auth.userId,
      action: 'VIEW_USERS',
      meta: { 
        role: role || 'all',
        status: status || 'all',
        search: search || null,
        page,
        limit,
        total_viewed: usersWithCounts.length,
      },
    })

    return successResponse({
      users: usersWithCounts,
      pagination: {
        page,
        limit,
        total: filteredCount,
        totalPages: Math.ceil(filteredCount / limit),
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
