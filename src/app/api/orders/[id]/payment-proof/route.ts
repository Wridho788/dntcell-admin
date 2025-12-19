import { NextRequest } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/api/_core/supabase-server'
import { requireAuth } from '@/api/_core/auth'
import { successResponse, errorResponse, unauthorizedResponse } from '@/api/_core/response'
import { parseRequestBody } from '@/api/_core/validator'
import { handleApiError } from '@/api/_core/error'
import { logActivity } from '@/api/_core/activity-logger'
import { sendAdminNotification } from '@/lib/notifications/notification-helper'
import { 
  assertOrderTransition, 
  PaymentMethod,
  PaymentStatus,
  OrderStatus 
} from '@/lib/domain/order-states'

const uploadPaymentProofSchema = z.object({
  payment_reference: z.string().url({ message: 'Payment proof URL is required' }),
})

// POST /api/orders/:id/payment-proof - Upload payment proof (USER only, bank_transfer only)
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
    const validation = await parseRequestBody(request, uploadPaymentProofSchema)
    if (!validation.success) {
      return errorResponse(validation.error, 422)
    }

    const { payment_reference } = validation.data

    // 1. Get order
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('*, product:products(name)')
      .eq('id', orderId)
      .single()

    if (orderError || !order) {
      return errorResponse('Order not found', 404)
    }

    // 2. Check ownership
    if (order.buyer_id !== auth.userId) {
      return errorResponse('You can only upload payment proof for your own orders', 403)
    }

    // 3. Validate state transition
    try {
      assertOrderTransition({
        currentOrder: {
          order_status: order.order_status as OrderStatus,
          payment_status: order.payment_status as PaymentStatus,
          payment_method: order.payment_method as PaymentMethod,
        },
        nextPaymentStatus: PaymentStatus.WAITING_CONFIRMATION,
        actor: 'user',
        action: 'upload_payment_proof',
      })
    } catch (error: any) {
      return errorResponse(
        error.message || 'Cannot upload payment proof for this order',
        error.status || 409
      )
    }

    // 4. Update order
    const { data: updatedOrder, error: updateError } = await supabaseAdmin
      .from('orders')
      .update({
        payment_status: PaymentStatus.WAITING_CONFIRMATION,
        payment_reference,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId)
      .select()
      .single()

    if (updateError) {
      return errorResponse(updateError.message)
    }

    // 5. Send notification to admins
    await sendAdminNotification({
      type: 'payment_proof_uploaded',
      title: 'Payment Proof Uploaded',
      message: `Payment proof uploaded for order ${orderId.substring(0, 8)}`,
      data: {
        order_id: orderId,
        product_name: order.product?.name,
        payment_reference,
      },
      url: `${process.env.NEXT_PUBLIC_APP_URL}/orders/${orderId}`,
    })

    // 6. Log activity
    await logActivity({
      admin_id: auth.userId,
      action: 'USER_UPLOAD_PAYMENT_PROOF',
      meta: {
        order_id: orderId,
        payment_reference,
      },
    })

    return successResponse(updatedOrder, 'Payment proof uploaded successfully')
  } catch (error) {
    return handleApiError(error)
  }
}
