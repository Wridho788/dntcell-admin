import { NextRequest } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/api/_core/supabase-server'
import { requireAuth } from '@/api/_core/auth'
import { successResponse, errorResponse, unauthorizedResponse, notFoundResponse } from '@/api/_core/response'
import { parseRequestBody } from '@/api/_core/validator'
import { handleApiError } from '@/api/_core/error'
import { logActivity } from '@/api/_core/activity-logger'
import { recalculateProductPricing, createPricingSnapshot } from '@/lib/services/pricing-service'

// GET /api/products/[id] - Get product details
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { data: product, error } = await supabaseAdmin
      .from('products')
      .select(`
        *,
        category:categories(id, name),
        seller:profiles(user_id, full_name),
        images:product_images(id, image_url, alt_text, is_main)
      `)
      .eq('id', params.id)
      .single()

    if (error || !product) {
      return notFoundResponse('Product not found')
    }

    return successResponse(product)
  } catch (error) {
    return handleApiError(error)
  }
}

// PUT /api/products/[id] - Update product
const updateProductSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  condition: z.enum(['new', 'like_new', 'good', 'fair']).optional(),
  base_price: z.number().positive().optional(),
  // Note: selling_price, min_nego_price, max_nego_price are auto-calculated
  negotiable: z.boolean().optional(),
  category_id: z.string().uuid().optional(),
  status: z.enum(['available', 'sold', 'reserved']).optional(),
  is_active: z.boolean().optional(),
})

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAuth(request)
    if (!auth) {
      return unauthorizedResponse()
    }

    const validation = await parseRequestBody(request, updateProductSchema)
    if (!validation.success) {
      return errorResponse(validation.error, 422)
    }

    // Check product exists and user owns it (or is admin)
    const { data: existingProduct, error: fetchError } = await supabaseAdmin
      .from('products')
      .select('seller_id')
      .eq('id', params.id)
      .single()

    if (fetchError || !existingProduct) {
      return notFoundResponse('Product not found')
    }

    if (!auth.isAdmin && existingProduct.seller_id !== auth.userId) {
      return errorResponse('You do not have permission to update this product', 403)
    }

    // Recalculate pricing if base_price or category_id changed
    let pricingUpdate = {}
    if (validation.data.base_price || validation.data.category_id) {
      const pricing = await recalculateProductPricing(
        params.id,
        validation.data.base_price,
        validation.data.category_id
      )
      pricingUpdate = {
        selling_price: pricing.sellingPrice,
        min_nego_price: pricing.minNegoPrice,
        max_nego_price: pricing.maxNegoPrice,
      }
    }

    // Update product with calculated prices
    const { data: product, error: updateError } = await supabaseAdmin
      .from('products')
      .update({
        ...validation.data,
        ...pricingUpdate,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.id)
      .select()
      .single()

    if (updateError) {
      return errorResponse(updateError.message)
    }

    // Create pricing snapshot if pricing changed
    const pricingSnapshot = Object.keys(pricingUpdate).length > 0
      ? createPricingSnapshot(
          product.base_price,
          product.selling_price,
          product.min_nego_price,
          product.max_nego_price
        )
      : undefined

    // Log activity with pricing snapshot
    await logActivity({
      admin_id: auth.userId,
      action: 'UPDATE_PRODUCT',
      meta: { 
        product_id: params.id,
        ...(pricingSnapshot && { pricing: pricingSnapshot }),
      },
    })

    return successResponse(product, 'Product updated successfully')
  } catch (error) {
    return handleApiError(error)
  }
}

// DELETE /api/products/[id] - Soft delete product
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAuth(request)
    if (!auth) {
      return unauthorizedResponse()
    }

    // Check product exists
    const { data: existingProduct, error: fetchError } = await supabaseAdmin
      .from('products')
      .select('seller_id, name')
      .eq('id', params.id)
      .single()

    if (fetchError || !existingProduct) {
      return notFoundResponse('Product not found')
    }

    if (!auth.isAdmin && existingProduct.seller_id !== auth.userId) {
      return errorResponse('You do not have permission to delete this product', 403)
    }

    // Soft delete
    const { error: deleteError } = await supabaseAdmin
      .from('products')
      .update({ 
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.id)

    if (deleteError) {
      return errorResponse(deleteError.message)
    }

    // Log activity
    await logActivity({
      admin_id: auth.userId,
      action: 'DELETE_PRODUCT',
      meta: { product_id: params.id, name: existingProduct.name },
    })

    return successResponse(null, 'Product deleted successfully')
  } catch (error) {
    return handleApiError(error)
  }
}
