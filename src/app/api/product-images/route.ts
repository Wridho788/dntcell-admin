import { NextRequest } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/api/_core/supabase-server';
import { successResponse, errorResponse, validationErrorResponse, serverErrorResponse, unauthorizedResponse } from '@/api/_core/response';
import { requireAuth } from '@/api/_core/auth';
import { parseRequestBody } from '@/api/_core/validator';
import { handleApiError } from '@/api/_core/error';
import { logActivity } from '@/api/_core/activity-logger';

// Schema for creating product image
const createProductImageSchema = z.object({
  product_id: z.string().uuid(),
  image_url: z.string().url(),
  display_order: z.number().int().min(0).optional(),
  is_main: z.boolean().optional().default(false),
});

/**
 * GET /api/product-images
 * List product images with filters
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (!authResult) {
      return unauthorizedResponse('Authentication required');
    }

    const { searchParams } = new URL(request.url);
    const product_id = searchParams.get('product_id');

    if (!product_id) {
      return validationErrorResponse('product_id is required');
    }

    let query = supabaseAdmin
      .from('product_images')
      .select('*')
      .eq('product_id', product_id)
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: true });

    const { data, error } = await query;

    if (error) {
      console.error('[GET /api/product-images] Error:', error);
      return serverErrorResponse('Failed to fetch product images');
    }

    return successResponse(data);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/product-images
 * Create new product image (owner or admin)
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (!authResult) {
      return unauthorizedResponse('Authentication required');
    }
    const { userId, isAdmin } = authResult;

    const parseResult = await parseRequestBody(request, createProductImageSchema);
    if (!parseResult.success) {
      return errorResponse(parseResult.error, 422);
    }
    const payload = parseResult.data;

    // Check if product exists and user is owner or admin
    const { data: product, error: productError } = await supabaseAdmin
      .from('products')
      .select('id, seller_id, name')
      .eq('id', payload.product_id)
      .single();

    if (productError || !product) {
      return errorResponse('Product not found', 404);
    }

    // Only owner or admin can add images
    if (product.seller_id !== userId && !isAdmin) {
      return errorResponse('You can only add images to your own products', 403);
    }

    // If is_main is true, unset other main images
    if (payload.is_main) {
      await supabaseAdmin
        .from('product_images')
        .update({ is_main: false })
        .eq('product_id', payload.product_id);
    }

    const { data, error } = await supabaseAdmin
      .from('product_images')
      .insert(payload)
      .select()
      .single();

    if (error) {
      console.error('[POST /api/product-images] Error:', error);
      return serverErrorResponse('Failed to create product image');
    }

    // Log activity if admin
    if (isAdmin) {
      await logActivity({
        admin_id: userId,
        action: 'create_product_image',
        meta: {
          image_id: data.id,
          product_id: payload.product_id,
          product_name: product.name,
        },
      });
    }

    return successResponse(data, 'Product image created successfully', 201);
  } catch (error) {
    return handleApiError(error);
  }
}
