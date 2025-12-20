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

const cancelOrderSchema = z.object({
  cancel_reason: z.string().min(5, { message: 'Cancel reason must be at least 5 characters' }),
})

// POST /api/orders/:id/cancel - Cancel order (USER or ADMIN)
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAuth(request)
    if (!auth) {
      return unauthorizedResponse()
    }

    // Only admins can cancel orders
    if (!auth.isAdmin) {
      return errorResponse('Only admins can cancel orders', 403)
    }

    const { id: orderId } = params

    // Validate request body
    const validation = await parseRequestBody(request, cancelOrderSchema)
    if (!validation.success) {
      return errorResponse(validation.error, 422)
    }

    const { cancel_reason } = validation.data

    // 1. Get order with details
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select(`
        *,
        product:products(name),
        buyer:profiles!orders_buyer_id_fkey(user_id, onesignal_player_id)
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
        nextOrderStatus: OrderStatus.CANCELLED,
        actor: 'admin',
        action: 'cancel_order',
      })
    } catch (error: any) {
      return errorResponse(
        error.message || 'Cannot cancel this order',
        error.status || 409
      )
    }

    // 3. Update order status to cancelled
    const { data: updatedOrder, error: updateError } = await supabaseAdmin
      .from('orders')
      .update({
        order_status: OrderStatus.CANCELLED,
        cancel_reason,
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
      to_status: OrderStatus.CANCELLED,
      changed_by: auth.userId,
      note: cancel_reason,
    })

    // 5. Return stock to product if it was already reduced (paid or completed status)
    // Only return stock if order was in paid status (stock was already reduced)
    if (order.order_status === OrderStatus.PAID) {
      await supabaseAdmin
        .from('products')
        .update({
          stock: order.product.stock + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', order.product_id)
    }

    // 6. If negotiation was used, mark it as unused so it can be used again
    if (order.negotiation_id) {
      await supabaseAdmin
        .from('negotiations')
        .update({ used: false })
        .eq('id', order.negotiation_id)
    }

    // 7. Create notification for buyer (silent mode - Sprint 2)
    await supabaseAdmin.from('notifications').insert({
      user_id: order.buyer_id,
      title: 'Order Cancelled',
      message: `Your order for ${order.product?.name} has been cancelled. Reason: ${cancel_reason}`,
      type: 'order_cancelled',
      meta: {
        order_id: orderId,
        product_id: order.product_id,
        cancel_reason,
      },
    })

    // 8. Log activity
    await logActivity({
      admin_id: auth.userId,
      action: 'ORDER_CANCELLED',
      meta: {
        order_id: orderId,
        product_id: order.product_id,
        buyer_id: order.buyer_id,
        from_status: order.order_status,
        to_status: OrderStatus.CANCELLED,
        cancel_reason,
      },
    })

    return successResponse({
      order: updatedOrder,
      message: 'Order cancelled successfully',
    })
  } catch (error) {
    return handleApiError(error)
  }
}
