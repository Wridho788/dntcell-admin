import { NextRequest } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/api/_core/supabase-server'
import { requireAuth } from '@/api/_core/auth'
import { successResponse, errorResponse, unauthorizedResponse } from '@/api/_core/response'
import { parseRequestBody } from '@/api/_core/validator'
import { handleApiError } from '@/api/_core/error'
import { logActivity } from '@/api/_core/activity-logger'
import { sendUserNotification, sendAdminNotification } from '@/lib/notifications/notification-helper'
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

    // 2. Check permissions
    const actor = auth.isAdmin ? 'admin' : 'user'
    
    // Non-admins can only cancel their own orders
    if (!auth.isAdmin && order.buyer_id !== auth.userId) {
      return errorResponse('You can only cancel your own orders', 403)
    }

    // 3. Validate state transition
    try {
      assertOrderTransition({
        currentOrder: {
          order_status: order.order_status as OrderStatus,
          payment_status: order.payment_status,
          payment_method: order.payment_method,
        },
        nextOrderStatus: OrderStatus.CANCELLED,
        actor,
        action: 'cancel_order',
      })
    } catch (error: any) {
      return errorResponse(
        error.message || 'Cannot cancel this order',
        error.status || 409
      )
    }

    // 4. Update order status to cancelled
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

    // 5. Return stock to product (atomic increment)
    await supabaseAdmin.rpc('increment_product_stock', {
      p_product_id: order.product_id,
      p_quantity: 1,
    })

    // 6. If negotiation was used, mark it as unused so it can be used again
    if (order.negotiation_id) {
      await supabaseAdmin
        .from('negotiations')
        .update({ used: false })
        .eq('id', order.negotiation_id)
    }

    // 7. Send notifications
    if (auth.isAdmin) {
      // Admin cancelled - notify buyer
      if (order.buyer?.user_id) {
        await sendUserNotification({
          userId: order.buyer.user_id,
          type: 'order_cancelled',
          title: 'Order Cancelled',
          message: `Your order for ${order.product?.name} has been cancelled`,
          data: {
            order_id: orderId,
            product_name: order.product?.name,
            cancel_reason,
            cancelled_by: 'admin',
          },
          url: `${process.env.NEXT_PUBLIC_APP_URL}/orders/${orderId}`,
        })
      }
    } else {
      // User cancelled - notify admins
      await sendAdminNotification({
        type: 'order_cancelled',
        title: 'Order Cancelled by User',
        message: `Order for ${order.product?.name} was cancelled by buyer`,
        data: {
          order_id: orderId,
          product_name: order.product?.name,
          cancel_reason,
          cancelled_by: 'user',
        },
        url: `${process.env.NEXT_PUBLIC_APP_URL}/orders/${orderId}`,
      })
    }

    // 8. Log activity
    await logActivity({
      admin_id: auth.userId,
      action: auth.isAdmin ? 'ADMIN_CANCEL_ORDER' : 'USER_CANCEL_ORDER',
      meta: {
        order_id: orderId,
        previous_order_status: order.order_status,
        new_order_status: OrderStatus.CANCELLED,
        cancel_reason,
        cancelled_by: actor,
      },
    })

    return successResponse(updatedOrder, 'Order cancelled successfully')
  } catch (error) {
    return handleApiError(error)
  }
}
