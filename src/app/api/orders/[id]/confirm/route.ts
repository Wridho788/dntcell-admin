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

const confirmOrderSchema = z.object({
  admin_note: z.string().optional(),
})

// POST /api/orders/:id/confirm - Admin confirms order is valid
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAuth(request)
    if (!auth) {
      return unauthorizedResponse()
    }

    // Only admins can confirm orders
    if (!auth.isAdmin) {
      return errorResponse('Only admins can confirm orders', 403)
    }

    const { id: orderId } = params

    // Validate request body (optional admin note)
    const validation = await parseRequestBody(request, confirmOrderSchema)
    if (!validation.success) {
      return errorResponse(validation.error, 422)
    }

    const { admin_note } = validation.data

    // 1. Get order with buyer details
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
        nextOrderStatus: OrderStatus.CONFIRMED,
        actor: 'admin',
        action: 'confirm_order',
      })
    } catch (error: any) {
      return errorResponse(
        error.message || 'Cannot confirm this order',
        error.status || 409
      )
    }

    // 3. Update order status to confirmed
    const { data: updatedOrder, error: updateError } = await supabaseAdmin
      .from('orders')
      .update({
        order_status: OrderStatus.CONFIRMED,
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
      to_status: OrderStatus.CONFIRMED,
      changed_by: auth.userId,
    })

    // 5. Send notification to buyer
    if (order.buyer?.user_id) {
      await sendUserNotification({
        userId: order.buyer.user_id,
        type: 'order_confirmed',
        title: 'Order Confirmed',
        message: `Your order for ${order.product?.name} has been confirmed`,
        data: {
          order_id: orderId,
          product_name: order.product?.name,
        },
        url: `${process.env.NEXT_PUBLIC_APP_URL}/orders/${orderId}`,
      })
    }

    // 6. Log activity
    await logActivity({
      admin_id: auth.userId,
      action: 'ORDER_CONFIRMED',
      meta: {
        order_id: orderId,
        previous_order_status: order.order_status,
        new_order_status: OrderStatus.CONFIRMED,
        admin_note,
      },
    })

    return successResponse(updatedOrder, 'Order confirmed successfully')
  } catch (error) {
    return handleApiError(error)
  }
}
