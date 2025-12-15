import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/api/_core/supabase-server'
import { requireAuth } from '@/api/_core/auth'
import { successResponse, errorResponse, unauthorizedResponse, notFoundResponse } from '@/api/_core/response'
import { handleApiError } from '@/api/_core/error'

// GET /api/orders/[id] - Get order details
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAuth(request)
    if (!auth) {
      return unauthorizedResponse()
    }

    // Get order with explicit FK references
    const { data: order, error } = await supabaseAdmin
      .from('orders')
      .select(`
        *,
        product:products(id, name, main_image_url, base_price, selling_price, condition),
        buyer:profiles!orders_buyer_id_fkey(user_id, full_name, email),
        negotiation:negotiations(id, offer_price, final_price, status, note)
      `)
      .eq('id', params.id)
      .single()

    if (error) {
      return errorResponse(error.message)
    }

    if (!order) {
      return notFoundResponse('Order not found')
    }

    // Authorization check: non-admin users can only see their own orders
    if (!auth.isAdmin && order.buyer_id !== auth.userId) {
      return errorResponse('You can only view your own orders', 403)
    }

    return successResponse(order)
  } catch (error) {
    return handleApiError(error)
  }
}
