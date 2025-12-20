import { NextRequest } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/api/_core/supabase-server'
import { requireAuth } from '@/api/_core/auth'
import { successResponse, errorResponse, unauthorizedResponse } from '@/api/_core/response'
import { parseRequestBody } from '@/api/_core/validator'
import { handleApiError } from '@/api/_core/error'
import { logActivity } from '@/api/_core/activity-logger'
import { sendUserNotification } from '@/lib/notifications/notification-helper'
import { 
  assertOrderTransition, 
  OrderStatus 
} from '@/lib/domain/order-states'

const rejectOrderSchema = z.object({
  reject_reason: z.string().min(10, { message: 'Reject reason must be at least 10 characters' }),
  admin_note: z.string().optional(),
})

// POST /api/orders/:id/reject - Reject order (ADMIN only)
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAuth(request)
    if (!auth) {
      return unauthorizedResponse()
    }

    // Only admins can reject orders
    if (!auth.isAdmin) {
      return errorResponse('Only admins can reject orders', 403)
    }

    const { id: orderId } = params

    // Validate request body
    const validation = await parseRequestBody(request, rejectOrderSchema)
    if (!validation.success) {
      return errorResponse(validation.error, 422)
    }

    const { reject_reason, admin_note } = validation.data

    // 1. Get order with buyer details
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select(`
        *,
        product:products(id, name),
        buyer:profiles!orders_buyer_id_fkey(user_id, full_name, onesignal_player_id)
      `)
      .eq('id', orderId)
      .single()

    if (orderError || !order) {
      return errorResponse('Order not found', 404)
    }

    // 2. Validate state transition
    try {
      assertOrderTransition({
        currentOrder: {
          order_status: order.order_status as OrderStatus,
          payment_status: order.payment_status,
          payment_method: order.payment_method,
        },
        nextOrderStatus: OrderStatus.REJECTED,
        actor: 'admin',
        action: 'reject_order',
      })
    } catch (error: any) {
      return errorResponse(
        error.message || 'Cannot reject this order',
        error.status || 409
      )
    }

    // 3. Update order status to rejected
    const { data: updatedOrder, error: updateError } = await supabaseAdmin
      .from('orders')
      .update({
        order_status: OrderStatus.REJECTED,
        cancel_reason: reject_reason,
        admin_note: admin_note || order.admin_note,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId)
      .select()
      .single()

    if (updateError) {
      return errorResponse(updateError.message)
    }

    // 4. Log status change in order_status_logs
    await supabaseAdmin.from('order_status_logs').insert({
      order_id: orderId,
      from_status: order.order_status,
      to_status: OrderStatus.REJECTED,
      changed_by: auth.userId,
      note: reject_reason,
    })

    // 5. Log admin activity
    await logActivity({
      admin_id: auth.userId,
      action: 'ORDER_REJECTED',
      meta: {
        order_id: orderId,
        product_id: order.product_id,
        buyer_id: order.buyer_id,
        from_status: order.order_status,
        to_status: OrderStatus.REJECTED,
        reject_reason,
      },
    })

    // 6. Create notification for buyer (silent mode - Sprint 2)
    await supabaseAdmin.from('notifications').insert({
      user_id: order.buyer_id,
      title: 'Order Rejected',
      message: `Your order for ${order.product?.name} has been rejected. Reason: ${reject_reason}`,
      type: 'order_rejected',
      meta: {
        order_id: orderId,
        product_id: order.product_id,
        reject_reason,
      },
    })

    return successResponse({
      order: updatedOrder,
      message: 'Order rejected successfully',
    })
  } catch (error) {
    return handleApiError(error)
  }
}
