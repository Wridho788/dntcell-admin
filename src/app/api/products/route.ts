import { NextRequest } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/api/_core/supabase-server'
import { requireAuth } from '@/api/_core/auth'
import { successResponse, errorResponse, unauthorizedResponse, notFoundResponse } from '@/api/_core/response'
import { parseRequestBody } from '@/api/_core/validator'
import { handleApiError } from '@/api/_core/error'
import { logActivity } from '@/api/_core/activity-logger'

// GET /api/products - List products with filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    
    const categoryId = searchParams.get('category_id')
    const sellerId = searchParams.get('seller_id')
    const status = searchParams.get('status')
    const isActive = searchParams.get('is_active')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    
    let query = supabaseAdmin
      .from('products')
      .select(`
        *,
        category:categories(id, name),
        seller:profiles(user_id, full_name),
        main_image:product_images(image_url, alt_text)
      `, { count: 'exact' })

    if (categoryId) {
      query = query.eq('category_id', categoryId)
    }
    
    if (sellerId) {
      query = query.eq('seller_id', sellerId)
    }
    
    if (status) {
      query = query.eq('status', status)
    }
    
    if (isActive !== null) {
      query = query.eq('is_active', isActive === 'true')
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
      products: data,
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

// POST /api/products - Create new product
const createProductSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  condition: z.enum(['new', 'like_new', 'good', 'fair']),
  base_price: z.number().positive(),
  selling_price: z.number().positive(),
  negotiable: z.boolean().default(false),
  category_id: z.string().uuid(),
  status: z.enum(['available', 'sold', 'reserved']).default('available'),
  images: z.array(z.object({
    image_url: z.string().url(),
    alt_text: z.string().optional(),
    is_main: z.boolean().default(false),
  })).optional(),
})

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (!auth) {
      return unauthorizedResponse()
    }

    const validation = await parseRequestBody(request, createProductSchema)
    if (!validation.success) {
      return errorResponse(validation.error, 422)
    }

    const { images, ...productData } = validation.data

    // Validate category exists
    const { data: category, error: categoryError } = await supabaseAdmin
      .from('categories')
      .select('id')
      .eq('id', validation.data.category_id)
      .single()

    if (categoryError || !category) {
      return errorResponse('Invalid category_id', 422)
    }

    // Insert product
    const { data: product, error: productError } = await supabaseAdmin
      .from('products')
      .insert({
        ...productData,
        seller_id: auth.userId,
        is_active: true,
      })
      .select()
      .single()

    if (productError) {
      return errorResponse(productError.message)
    }

    // Insert images if provided
    if (images && images.length > 0) {
      const imageInserts = images.map(img => ({
        product_id: product.id,
        image_url: img.image_url,
        alt_text: img.alt_text,
        is_main: img.is_main,
      }))

      await supabaseAdmin
        .from('product_images')
        .insert(imageInserts)
    }

    // Log activity
    await logActivity({
      admin_id: auth.userId,
      action: 'CREATE_PRODUCT',
      meta: { product_id: product.id, name: product.name },
    })

    return successResponse(product, 'Product created successfully', 201)
  } catch (error) {
    return handleApiError(error)
  }
}
