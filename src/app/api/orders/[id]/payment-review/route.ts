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
  PaymentStatus,
  OrderStatus 
} from '@/lib/domain/order-states'

const paymentReviewSchema = z.object({
  action: z.enum(['approve', 'reject'], { message: 'Action must be either approve or reject' }),
  admin_note: z.string().optional(),
})

// POST /api/orders/:id/payment-review - Review payment proof (ADMIN only)
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAuth(request)
    if (!auth) {
      return unauthorizedResponse()
    }

    // Only admins can review payment
    if (!auth.isAdmin) {
      return errorResponse('Only admins can review payment', 403)
    }

    const { id: orderId } = params

    // Validate request body
    const validation = await parseRequestBody(request, paymentReviewSchema)
    if (!validation.success) {
      return errorResponse(validation.error, 422)
    }

    const { action, admin_note } = validation.data

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

    // 2. Check current payment status
    if (order.payment_status !== PaymentStatus.WAITING_CONFIRMATION) {
      return errorResponse(
        'Can only review orders with payment status waiting_confirmation',
        409
      )
    }

    // 3. Determine next state based on action
    const nextPaymentStatus = action === 'approve' ? PaymentStatus.PAID : PaymentStatus.FAILED
    const nextOrderStatus = action === 'approve' ? OrderStatus.PAID : OrderStatus.PENDING_PAYMENT

    // 4. Validate state transition
    try {
      assertOrderTransition({
        currentOrder: {
          order_status: order.order_status as OrderStatus,
          payment_status: order.payment_status as PaymentStatus,
          payment_method: order.payment_method,
        },
        nextPaymentStatus,
        nextOrderStatus,
        actor: 'admin',
        action: action === 'approve' ? 'approve_payment' : 'reject_payment',
      })
    } catch (error: any) {
      return errorResponse(
        error.message || 'Invalid payment review action',
        error.status || 409
      )
    }

    // 5. Update order
    const { data: updatedOrder, error: updateError } = await supabaseAdmin
      .from('orders')
      .update({
        payment_status: nextPaymentStatus,
        order_status: nextOrderStatus,
        admin_note: admin_note || order.admin_note,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId)
      .select()
      .single()

    if (updateError) {
      return errorResponse(updateError.message)
    }

    // 6. Send notification to buyer
    const notificationTitle = action === 'approve' 
      ? 'Payment Confirmed' 
      : 'Payment Rejected'
    const notificationMessage = action === 'approve'
      ? `Your payment for ${order.product?.name} has been confirmed`
      : `Your payment for ${order.product?.name} has been rejected. Please reupload payment proof.`

    if (order.buyer?.user_id) {
      await sendUserNotification({
        userId: order.buyer.user_id,
        type: action === 'approve' ? 'payment_approved' : 'payment_rejected',
        title: notificationTitle,
        message: notificationMessage,
        data: {
          order_id: orderId,
          product_name: order.product?.name,
          action,
        },
        url: `${process.env.NEXT_PUBLIC_APP_URL}/orders/${orderId}`,
      })
    }

    // 7. Log activity
    await logActivity({
      admin_id: auth.userId,
      action: action === 'approve' ? 'ADMIN_APPROVE_PAYMENT' : 'ADMIN_REJECT_PAYMENT',
      meta: {
        order_id: orderId,
        previous_payment_status: order.payment_status,
        new_payment_status: nextPaymentStatus,
        new_order_status: nextOrderStatus,
        admin_note,
      },
    })

    return successResponse(
      updatedOrder,
      action === 'approve' ? 'Payment approved successfully' : 'Payment rejected successfully'
    )
  } catch (error) {
    return handleApiError(error)
  }
}
