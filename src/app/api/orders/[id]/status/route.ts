import { NextRequest } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/api/_core/supabase-server'
import { requireAdmin } from '@/api/_core/auth'
import { successResponse, errorResponse, notFoundResponse } from '@/api/_core/response'
import { parseRequestBody } from '@/api/_core/validator'
import { handleApiError } from '@/api/_core/error'
import { logActivity } from '@/api/_core/activity-logger'
import { sendUserNotification } from '@/lib/onesignal'

// PUT /api/orders/[id]/status - Update order status (Admin only)
const updateStatusSchema = z.object({
  order_status: z.enum(['pending', 'processing', 'completed', 'canceled']),
  admin_note: z.string().optional(),
})

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireAdmin(request)
    if ('userId' in authResult === false) {
      return authResult // Return error response
    }
    const auth = authResult

    const validation = await parseRequestBody(request, updateStatusSchema)
    if (!validation.success) {
      return errorResponse(validation.error, 422)
    }

    // Get current order
    const { data: order, error: fetchError } = await supabaseAdmin
      .from('orders')
      .select(`
        *,
        product:products(id, name),
        buyer:profiles!orders_buyer_id_fkey(user_id, full_name, email, onesignal_player_id)
      `)
      .eq('id', params.id)
      .single()

    if (fetchError || !order) {
      return notFoundResponse('Order not found')
    }

    // Update order
    const { data: updated, error: updateError } = await supabaseAdmin
      .from('orders')
      .update({
        order_status: validation.data.order_status,
        admin_note: validation.data.admin_note,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.id)
      .select()
      .single()

    if (updateError) {
      return errorResponse(updateError.message)
    }

    // Create notification for buyer
    const statusMessages: Record<string, string> = {
      pending: 'Your order is pending confirmation',
      processing: 'Your order is being processed',
      completed: 'Your order has been completed',
      canceled: 'Your order has been canceled',
    }

    await supabaseAdmin
      .from('notifications')
      .insert({
        user_id: order.buyer_id,
        type: 'order_status_updated',
        title: 'Order Status Updated',
        message: statusMessages[validation.data.order_status] || 'Your order status has been updated',
        data: { 
          order_id: params.id,
          order_status: validation.data.order_status,
          note: validation.data.admin_note,
        },
      })

    // Log activity
    await logActivity({
      admin_id: auth.userId,
      action: 'UPDATE_ORDER_STATUS',
      meta: { 
        order_id: params.id,
        from_status: order.order_status,
        to_status: validation.data.order_status,
        admin_note: validation.data.admin_note,
      },
    })

    // Send push notification to buyer (user notification, not admin)
    if (order.buyer.onesignal_player_id) {
      sendUserNotification(
        order.buyer_id,
        'Order Status Updated 📦',
        statusMessages[validation.data.order_status] || 'Your order status has been updated',
        {
          order_id: params.id,
          order_status: validation.data.order_status,
          product_name: order.product.name,
        },
        `${process.env.NEXT_PUBLIC_APP_URL}/orders/${params.id}`
      ).catch((error) => {
        console.error('[Order Status] Failed to send push notification:', error)
      })
    }

    return successResponse(updated, 'Order status updated successfully')
  } catch (error) {
    return handleApiError(error)
  }
}
