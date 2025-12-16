import { NextRequest } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/api/_core/supabase-server'
import { requireAuth } from '@/api/_core/auth'
import { successResponse, errorResponse, unauthorizedResponse } from '@/api/_core/response'
import { parseRequestBody } from '@/api/_core/validator'
import { handleApiError } from '@/api/_core/error'
import { logActivity } from '@/api/_core/activity-logger'
import { sendBulkAdminNotification } from '@/lib/onesignal'

// GET /api/orders - List orders
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (!auth) {
      return unauthorizedResponse()
    }

    const { searchParams } = new URL(request.url)
    
    const orderStatus = searchParams.get('order_status')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    let query = supabaseAdmin
      .from('orders')
      .select(`
        *,
        product:products(id, name, main_image_url),
        buyer:profiles!orders_buyer_id_fkey(user_id, full_name, email),
        negotiation:negotiations(id, offer_price, final_price)
      `, { count: 'exact' })

    // Filter by user role
    if (!auth.isAdmin) {
      query = query.eq('buyer_id', auth.userId)
    }

    // Fix: Only apply filter if orderStatus is not null/empty/all
    if (orderStatus && orderStatus !== 'all') {
      query = query.eq('order_status', orderStatus)
    }

    // Pagination
    const from = (page - 1) * limit
    const to = from + limit - 1

    query = query
      .order('created_at', { ascending: false })
      .range(from, to)

    const { data, error, count } = await query

    if (error) {
      return errorResponse(error.message)
    }

    return successResponse({
      orders: data,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}

// POST /api/orders - Create new order
const createOrderSchema = z.object({
  product_id: z.string().uuid(),
  negotiation_id: z.string().uuid().optional(),
  payment_method: z.enum(['cod', 'transfer', 'ewallet']),
  shipping_address: z.string().min(1),
  note: z.string().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (!auth) {
      return unauthorizedResponse()
    }

    const validation = await parseRequestBody(request, createOrderSchema)
    if (!validation.success) {
      return errorResponse(validation.error, 422)
    }

    const { negotiation_id, product_id, ...orderData } = validation.data

    // Get product
    const { data: product, error: productError } = await supabaseAdmin
      .from('products')
      .select('id, name, selling_price, seller_id, is_active')
      .eq('id', product_id)
      .single()

    if (productError || !product) {
      return errorResponse('Product not found', 404)
    }

    if (!product.is_active) {
      return errorResponse('Product is not available', 400)
    }

    let finalPrice = product.selling_price

    // If negotiation_id provided, validate it
    if (negotiation_id) {
      const { data: negotiation, error: negotiationError } = await supabaseAdmin
        .from('negotiations')
        .select('id, status, final_price, used')
        .eq('id', negotiation_id)
        .eq('buyer_id', auth.userId)
        .eq('product_id', product_id)
        .single()

      if (negotiationError || !negotiation) {
        return errorResponse('Invalid negotiation', 400)
      }

      if (negotiation.status !== 'approved') {
        return errorResponse('Negotiation must be approved', 400)
      }

      if (negotiation.used) {
        return errorResponse('Negotiation already used', 400)
      }

      finalPrice = negotiation.final_price || product.selling_price

      // Mark negotiation as used
      await supabaseAdmin
        .from('negotiations')
        .update({ used: true })
        .eq('id', negotiation_id)
    }

    // Create order
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .insert({
        product_id,
        buyer_id: auth.userId,
        seller_id: product.seller_id,
        negotiation_id,
        price: finalPrice,
        payment_method: orderData.payment_method,
        shipping_address: orderData.shipping_address,
        note: orderData.note,
        order_status: 'pending',
      })
      .select()
      .single()

    if (orderError) {
      return errorResponse(orderError.message)
    }

    // Create notification for seller/admin
    await supabaseAdmin
      .from('notifications')
      .insert({
        user_id: product.seller_id,
        type: 'new_order',
        title: 'New Order Received',
        message: `New order for ${product.name}`,
        data: { order_id: order.id },
      })

    // Log activity - USER action, not admin
    await logActivity({
      admin_id: auth.userId,
      action: 'USER_CREATE_ORDER',
      meta: { 
        order_id: order.id,
        product_id,
        price: finalPrice,
        buyer_id: auth.userId,
      },
    })

    // Send push notification to all admins
    sendBulkAdminNotification(
      'New Order Received',
      `New order for ${product.name} - Rp ${finalPrice.toLocaleString()}`,
      {
        order_id: order.id,
        product_id,
        product_name: product.name,
        price: finalPrice,
        payment_method: orderData.payment_method,
      },
      `${process.env.NEXT_PUBLIC_APP_URL}/orders`
    ).catch((error) => {
      console.error('[Order] Failed to send push notification:', error)
    })

    return successResponse(order, 'Order created successfully', 201)
  } catch (error) {
    return handleApiError(error)
  }
}
