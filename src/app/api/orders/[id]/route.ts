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

    // Get order with explicit FK references and status logs
    const { data: order, error } = await supabaseAdmin
      .from('orders')
      .select(`
        *,
        product:products(id, name, main_image_url, base_price, selling_price, condition, stock),
        buyer:profiles!orders_buyer_id_fkey(user_id, full_name, email),
        seller:profiles!orders_seller_id_fkey(user_id, full_name, email),
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

    // Get order status logs (timeline)
    const { data: statusLogs } = await supabaseAdmin
      .from('order_status_logs')
      .select(`
        *,
        admin:profiles!order_status_logs_changed_by_fkey(user_id, full_name, email)
      `)
      .eq('order_id', params.id)
      .order('created_at', { ascending: true })

    return successResponse({
      ...order,
      status_logs: statusLogs || [],
    })
  } catch (error) {
    return handleApiError(error)
  }
}
