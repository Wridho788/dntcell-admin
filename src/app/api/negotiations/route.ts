import { NextRequest } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/api/_core/supabase-server'
import { requireAuth } from '@/api/_core/auth'
import { successResponse, errorResponse, unauthorizedResponse } from '@/api/_core/response'
import { parseRequestBody } from '@/api/_core/validator'
import { handleApiError } from '@/api/_core/error'
import { validateNegotiationOffer } from '@/lib/services/pricing-service'
import { sendAdminNotification } from '@/lib/notifications/notification-helper'

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

    // Build query - select specific fields to avoid relationship issues
    let query = supabaseAdmin
      .from('negotiations')
      .select(`
        *,
        product_id,
        buyer_id,
        admin_id
      `, { count: 'exact' })

    // Filter by user role - SECURITY: Non-admins can only see their own negotiations
    if (!auth.isAdmin) {
      query = query.eq('buyer_id', auth.userId)
    }

    // Fix: Only apply filters if values are not null/empty/all
    if (productId && productId !== 'all') {
      query = query.eq('product_id', productId)
    }

    if (status && status !== 'all') {
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

    // Fetch related data manually to avoid relationship issues
    const negotiationsWithDetails = await Promise.all(
      (data || []).map(async (negotiation) => {
        // Fetch product details
        const { data: product } = await supabaseAdmin
          .from('products')
          .select('id, name, selling_price, main_image_url')
          .eq('id', negotiation.product_id)
          .single()

        // Fetch buyer details
        const { data: buyer } = await supabaseAdmin
          .from('profiles')
          .select('user_id, full_name, email')
          .eq('user_id', negotiation.buyer_id)
          .single()

        return {
          ...negotiation,
          product: product || null,
          buyer: buyer || null,
        }
      })
    )

    return successResponse({
      negotiations: negotiationsWithDetails,
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

    // Send notification to all admins (DB + Push)
    await sendAdminNotification({
      type: 'new_negotiation',
      title: 'New Price Negotiation',
      message: `New offer for ${product.name}: Rp ${validation.data.offer_price.toLocaleString('id-ID')}`,
      data: { 
        negotiation_id: negotiation.id,
        product_id: product.id,
        product_name: product.name,
        offer_price: validation.data.offer_price,
      },
      url: `${process.env.NEXT_PUBLIC_APP_URL}/negotiations`,
    })

    return successResponse(negotiation, 'Negotiation created successfully', 201)
  } catch (error) {
    return handleApiError(error)
  }
}
