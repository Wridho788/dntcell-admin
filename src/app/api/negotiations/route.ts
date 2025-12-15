import { NextRequest } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/api/_core/supabase-server'
import { requireAuth } from '@/api/_core/auth'
import { successResponse, errorResponse, unauthorizedResponse } from '@/api/_core/response'
import { parseRequestBody } from '@/api/_core/validator'
import { handleApiError } from '@/api/_core/error'
import { sendBulkAdminNotification } from '@/lib/onesignal'
import { validateNegotiationOffer, createPricingSnapshot } from '@/lib/services/pricing-service'

// GET /api/negotiations - List negotiations
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (!auth) {
      return unauthorizedResponse()
    }

    const { searchParams } = new URL(request.url)
    
    const productId = searchParams.get('product_id')
    const status = searchParams.get('status')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    let query = supabaseAdmin
      .from('negotiations')
      .select(`
        *,
        product:products(id, name, selling_price, main_image_url),
        buyer:profiles(user_id, full_name, email)
      `, { count: 'exact' })

    // Filter by user role
    if (!auth.isAdmin) {
      query = query.eq('buyer_id', auth.userId)
    }

    if (productId) {
      query = query.eq('product_id', productId)
    }

    if (status) {
      query = query.eq('status', status)
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
      negotiations: data,
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

// POST /api/negotiations - Create new negotiation
const createNegotiationSchema = z.object({
  product_id: z.string().uuid(),
  offer_price: z.number().positive(),
  note: z.string().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (!auth) {
      return unauthorizedResponse()
    }

    const validation = await parseRequestBody(request, createNegotiationSchema)
    if (!validation.success) {
      return errorResponse(validation.error, 422)
    }

    // Validate product is active
    const { data: product, error: productError } = await supabaseAdmin
      .from('products')
      .select('id, name, selling_price, base_price, min_nego_price, max_nego_price, seller_id, is_active, negotiable')
      .eq('id', validation.data.product_id)
      .single()

    if (productError || !product) {
      return errorResponse('Product not found', 404)
    }

    if (!product.is_active) {
      return errorResponse('Product is not active', 400)
    }

    if (!product.negotiable) {
      return errorResponse('Product is not negotiable', 400)
    }

    // Validate offer price with pricing rules (HARD LOCK)
    const priceValidation = await validateNegotiationOffer(
      validation.data.product_id,
      validation.data.offer_price
    )

    if (!priceValidation.valid) {
      return errorResponse(priceValidation.reason || 'Invalid offer price', 400)
    }

    // Insert negotiation
    const { data: negotiation, error: insertError } = await supabaseAdmin
      .from('negotiations')
      .insert({
        product_id: validation.data.product_id,
        buyer_id: auth.userId,
        offer_price: validation.data.offer_price,
        note: validation.data.note,
        status: 'pending',
      })
      .select()
      .single()

    if (insertError) {
      return errorResponse(insertError.message)
    }

    // Create notification for admin
    await supabaseAdmin
      .from('notifications')
      .insert({
        user_id: product.seller_id,
        type: 'new_negotiation',
        title: 'New Price Negotiation',
        message: `New offer for ${product.name}: ${validation.data.offer_price}`,
        data: { negotiation_id: negotiation.id },
      })

    // Send push notification to all admins
    sendBulkAdminNotification(
      'New Price Negotiation',
      `New offer for ${product.name}: Rp ${validation.data.offer_price.toLocaleString()}`,
      { 
        negotiation_id: negotiation.id,
        product_id: product.id,
        product_name: product.name,
        offer_price: validation.data.offer_price,
      },
      `${process.env.NEXT_PUBLIC_APP_URL}/negotiations`
    ).catch((error) => {
      console.error('[Negotiation] Failed to send push notification:', error)
    })

    return successResponse(negotiation, 'Negotiation created successfully', 201)
  } catch (error) {
    return handleApiError(error)
  }
}
