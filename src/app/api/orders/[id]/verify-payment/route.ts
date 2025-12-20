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
  OrderStatus,
  PaymentStatus,
  PaymentMethod 
} from '@/lib/domain/order-states'

const verifyPaymentSchema = z.object({
  payment_reference: z.string().optional(),
  admin_note: z.string().optional(),
})

// POST /api/orders/:id/verify-payment - Verify transfer payment (ADMIN only)
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAuth(request)
    if (!auth) {
      return unauthorizedResponse()
    }

    // Only admins can verify payments
    if (!auth.isAdmin) {
      return errorResponse('Only admins can verify payments', 403)
    }

    const { id: orderId } = params

    // Validate request body
    const validation = await parseRequestBody(request, verifyPaymentSchema)
    if (!validation.success) {
      return errorResponse(validation.error, 422)
    }

    const { payment_reference, admin_note } = validation.data

    // 1. Get order with buyer and product details
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select(`
        *,
        product:products(id, name, stock),
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
        nextPaymentStatus: PaymentStatus.PAID,
        actor: 'admin',
        action: 'verify_payment',
      })
    } catch (error: any) {
      return errorResponse(
        error.message || 'Cannot verify payment for this order',
        error.status || 409
      )
    }

    // 3. Check stock availability (CRITICAL - Stock Safety)
    if (order.product && order.product.stock < 1) {
      return errorResponse('Product is out of stock. Cannot verify payment.', 400)
    }

    // 4. Update order - mark as paid and reduce stock
    const { data: updatedOrder, error: updateError } = await supabaseAdmin
      .from('orders')
      .update({
        order_status: OrderStatus.PAID,
        payment_status: PaymentStatus.PAID,
        payment_reference: payment_reference || order.payment_reference,
        admin_note: admin_note || order.admin_note,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId)
      .select()
      .single()

    if (updateError) {
      return errorResponse(updateError.message)
    }

    // 5. Reduce product stock (CRITICAL - Stock Safety)
    const { error: stockError } = await supabaseAdmin
      .from('products')
      .update({
        stock: order.product.stock - 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', order.product_id)
      .gt('stock', 0) // Only update if stock > 0

    if (stockError) {
      // Rollback order status if stock update fails
      await supabaseAdmin
        .from('orders')
        .update({
          order_status: order.order_status,
          payment_status: order.payment_status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', orderId)

      return errorResponse('Failed to update product stock. Payment verification cancelled.', 500)
    }

    // 6. Log status change in order_status_logs
    await supabaseAdmin.from('order_status_logs').insert({
      order_id: orderId,
      from_status: order.order_status,
      to_status: OrderStatus.PAID,
      changed_by: auth.userId,
      note: payment_reference 
        ? `Payment verified - Reference: ${payment_reference}`
        : 'Payment verified',
    })

    // 7. Log admin activity
    await logActivity({
      admin_id: auth.userId,
      action: 'PAYMENT_VERIFIED',
      meta: {
        order_id: orderId,
        product_id: order.product_id,
        buyer_id: order.buyer_id,
        from_status: order.order_status,
        to_status: OrderStatus.PAID,
        payment_method: order.payment_method,
        payment_reference,
      },
    })

    // 8. Create notification for buyer (silent mode - Sprint 2)
    await supabaseAdmin.from('notifications').insert({
      user_id: order.buyer_id,
      title: 'Payment Verified',
      message: `Your payment for ${order.product?.name} has been verified. Order is now being processed.`,
      type: 'payment_verified',
      meta: {
        order_id: orderId,
        product_id: order.product_id,
      },
    })

    return successResponse({
      order: updatedOrder,
      message: 'Payment verified successfully',
    })
  } catch (error) {
    return handleApiError(error)
  }
}
