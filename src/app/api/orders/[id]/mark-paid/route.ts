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
  PaymentStatus 
} from '@/lib/domain/order-states'

const markAsPaidSchema = z.object({
  admin_note: z.string().optional(),
})

// POST /api/orders/:id/mark-paid - Admin marks payment as received (transfer only)
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAuth(request)
    if (!auth) {
      return unauthorizedResponse()
    }

    // Only admins can mark as paid
    if (!auth.isAdmin) {
      return errorResponse('Only admins can mark payments as paid', 403)
    }

    const { id: orderId } = params

    // Validate request body (optional admin note)
    const validation = await parseRequestBody(request, markAsPaidSchema)
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
          order_status: order.order_status,
          payment_status: order.payment_status as PaymentStatus,
          payment_method: order.payment_method,
        },
        nextPaymentStatus: PaymentStatus.PAID,
        actor: 'admin',
        action: 'mark_as_paid',
      })
    } catch (error: any) {
      return errorResponse(
        error.message || 'Cannot mark this order as paid',
        error.status || 409
      )
    }

    // 3. Update payment status to paid
    const { data: updatedOrder, error: updateError } = await supabaseAdmin
      .from('orders')
      .update({
        payment_status: PaymentStatus.PAID,
        admin_note: admin_note || order.admin_note,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId)
      .select()
      .single()

    if (updateError) {
      return errorResponse(updateError.message)
    }

    // 4. Send notification to buyer
    if (order.buyer?.user_id) {
      await sendUserNotification({
        userId: order.buyer.user_id,
        type: 'payment_confirmed',
        title: 'Payment Confirmed',
        message: `Payment for ${order.product?.name} has been confirmed`,
        data: {
          order_id: orderId,
          product_name: order.product?.name,
        },
        url: `${process.env.NEXT_PUBLIC_APP_URL}/orders/${orderId}`,
      })
    }

    // 5. Log activity
    await logActivity({
      admin_id: auth.userId,
      action: 'PAYMENT_MARKED_PAID',
      meta: {
        order_id: orderId,
        previous_payment_status: order.payment_status,
        new_payment_status: PaymentStatus.PAID,
        admin_note,
      },
    })

    return successResponse(updatedOrder, 'Payment marked as paid successfully')
  } catch (error) {
    return handleApiError(error)
  }
}
