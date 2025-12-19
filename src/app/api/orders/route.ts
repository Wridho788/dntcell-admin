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
  getInitialOrderState, 
  PaymentMethod 
} from '@/lib/domain/order-states'

// GET /api/orders - List orders
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (!auth) {
      return unauthorizedResponse()
    }

    const { searchParams } = new URL(request.url)
    
    const orderStatus = searchParams.get('order_status')
    const paymentStatus = searchParams.get('payment_status')
    const paymentMethod = searchParams.get('payment_method')
    const search = searchParams.get('search')
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

    // Fix: Only apply filters if values are not null/empty/all
    if (orderStatus && orderStatus !== 'all') {
      query = query.eq('order_status', orderStatus)
    }

    if (paymentStatus && paymentStatus !== 'all') {
      query = query.eq('payment_status', paymentStatus)
    }

    if (paymentMethod && paymentMethod !== 'all') {
      query = query.eq('payment_method', paymentMethod)
    }

    // Search by order ID or product name (implement via filter after fetch due to join limitations)
    const from = (page - 1) * limit
    const to = from + limit - 1

    query = query
      .order('created_at', { ascending: false })

    // If search query exists, we need to fetch more and filter in memory
    // due to Supabase join limitations
    if (search && search.trim()) {
      query = query.range(0, 999) // Fetch more for filtering
    } else {
      query = query.range(from, to)
    }

    const { data, error, count } = await query

    if (error) {
      return errorResponse(error.message)
    }

    // Client-side filtering for search
    let filteredData = data || []
    let filteredCount = count || 0

    if (search && search.trim()) {
      const searchLower = search.toLowerCase()
      filteredData = filteredData.filter((order) => {
        const matchesId = order.id.toLowerCase().includes(searchLower)
        const matchesProduct = order.product?.name?.toLowerCase().includes(searchLower)
        return matchesId || matchesProduct
      })
      filteredCount = filteredData.length
      
      // Apply pagination to filtered results
      filteredData = filteredData.slice(from, to + 1)
    }

    return successResponse({
      orders: filteredData,
      pagination: {
        page,
        limit,
        total: filteredCount,
        totalPages: Math.ceil(filteredCount / limit),
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
  payment_method: z.enum(['cod', 'transfer']),
  shipping_address: z.string().min(10, { message: 'Shipping address must be at least 10 characters' }),
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

    const { negotiation_id, product_id, payment_method, shipping_address, note } = validation.data

    // 1. Validate product exists and is active
    const { data: product, error: productError } = await supabaseAdmin
      .from('products')
      .select('id, name, selling_price, seller_id, is_active, stock')
      .eq('id', product_id)
      .single()

    if (productError || !product) {
      return errorResponse('Product not found', 404)
    }

    if (!product.is_active) {
      return errorResponse('Product is not available', 400)
    }

    // 2. Check stock
    if (product.stock <= 0) {
      return errorResponse('Product is out of stock', 400)
    }

    // 3. Buyer cannot be the seller
    if (product.seller_id === auth.userId) {
      return errorResponse('You cannot buy your own product', 400)
    }

    let finalPrice = product.selling_price

    // 4. If negotiation_id provided, validate it
    if (negotiation_id) {
      const { data: negotiation, error: negotiationError } = await supabaseAdmin
        .from('negotiations')
        .select('id, status, final_price, used, buyer_id')
        .eq('id', negotiation_id)
        .eq('product_id', product_id)
        .single()

      if (negotiationError || !negotiation) {
        return errorResponse('Invalid negotiation', 400)
      }

      if (negotiation.buyer_id !== auth.userId) {
        return errorResponse('This negotiation does not belong to you', 403)
      }

      if (negotiation.status !== 'approved') {
        return errorResponse('Negotiation must be approved', 400)
      }

      if (negotiation.used) {
        return errorResponse('Negotiation already used', 400)
      }

      finalPrice = negotiation.final_price || product.selling_price
    }

    // 5. Get initial order state - always pending
    const paymentMethodEnum = payment_method === 'cod' ? PaymentMethod.COD : PaymentMethod.TRANSFER
    const initialState = getInitialOrderState(paymentMethodEnum)

    // 6. Validate the initial state transition
    try {
      assertOrderTransition({
        currentOrder: initialState,
        actor: 'user',
        action: 'create_order',
      })
    } catch (error: any) {
      return errorResponse(error.message || 'Invalid order state', error.status || 400)
    }

    // 7. Create order (atomic transaction with stock reduction)
    const { data: order, error: orderError } = await supabaseAdmin.rpc('create_order_with_stock_reduction', {
      p_product_id: product_id,
      p_buyer_id: auth.userId,
      p_seller_id: product.seller_id,
      p_negotiation_id: negotiation_id || null,
      p_price: finalPrice,
      p_payment_method: payment_method,
      p_order_status: initialState.order_status,
      p_payment_status: initialState.payment_status,
      p_shipping_address: shipping_address,
      p_note: note || null,
    })

    if (orderError) {
      return errorResponse(orderError.message)
    }

    // If order creation failed (no data returned)
    if (!order || order.length === 0) {
      return errorResponse('Failed to create order', 500)
    }

    const createdOrder = order[0]

    // 8. If negotiation was used, mark it as used
    if (negotiation_id) {
      await supabaseAdmin
        .from('negotiations')
        .update({ used: true })
        .eq('id', negotiation_id)
    }

    // 9. Send notification to all admins (DB + Push)
    await sendAdminNotification({
      type: 'new_order',
      title: 'New Order Received',
      message: `New order for ${product.name} - Rp ${finalPrice.toLocaleString('id-ID')}`,
      data: { 
        order_id: createdOrder.id,
        product_id,
        product_name: product.name,
        price: finalPrice,
        payment_method: payment_method,
      },
      url: `${process.env.NEXT_PUBLIC_APP_URL}/orders/${createdOrder.id}`,
    })

    // 10. Log activity
    await logActivity({
      admin_id: auth.userId,
      action: 'USER_CREATE_ORDER',
      meta: { 
        order_id: createdOrder.id,
        product_id,
        price: finalPrice,
        buyer_id: auth.userId,
        payment_method: payment_method,
        order_status: initialState.order_status,
        payment_status: initialState.payment_status,
      },
    })

    return successResponse(createdOrder, 'Order created successfully', 201)
  } catch (error) {
    return handleApiError(error)
  }
}
