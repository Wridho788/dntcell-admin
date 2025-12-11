import { NextRequest } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin, isUserAdmin } from '@/api/_core/supabase-server';
import { successResponse, errorResponse, validationErrorResponse, serverErrorResponse, notFoundResponse, unauthorizedResponse } from '@/api/_core/response';
import { requireAuth } from '@/api/_core/auth';
import { parseRequestBody } from '@/api/_core/validator';
import { handleApiError } from '@/api/_core/error';
import { logActivity } from '@/api/_core/activity-logger';

// Schema for updating product image
const updateProductImageSchema = z.object({
  display_order: z.number().int().min(0).optional(),
  is_main: z.boolean().optional(),
});

/**
 * GET /api/product-images/:id
 * Get single product image
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireAuth(request);
    if (!authResult) {
      return unauthorizedResponse('Authentication required');
    }

    const { data, error } = await supabaseAdmin
      .from('product_images')
      .select('*')
      .eq('id', params.id)
      .single();

    if (error || !data) {
      return notFoundResponse('Product image not found');
    }

    return successResponse(data);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PATCH /api/product-images/:id
 * Update product image (owner or admin)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireAuth(request);
    if (!authResult) {
      return unauthorizedResponse('Authentication required');
    }
    const { userId, isAdmin } = authResult;

    const parseResult = await parseRequestBody(request, updateProductImageSchema);
    if (!parseResult.success) {
      return errorResponse(parseResult.error, 422);
    }
    const payload = parseResult.data;

    // Get current image with product info
    const { data: currentImage, error: fetchError } = await supabaseAdmin
      .from('product_images')
      .select('*, products!inner(id, seller_id, name)')
      .eq('id', params.id)
      .single();

    if (fetchError || !currentImage) {
      return notFoundResponse('Product image not found');
    }

    // Only owner or admin can update
    const product = currentImage.products as any;
    if (product.seller_id !== userId && !isAdmin) {
      return errorResponse('You can only update images of your own products', 403);
    }

    // If setting as main image, unset other main images
    if (payload.is_main === true) {
      await supabaseAdmin
        .from('product_images')
        .update({ is_main: false })
        .eq('product_id', product.id);
    }

    const { data, error } = await supabaseAdmin
      .from('product_images')
      .update(payload)
      .eq('id', params.id)
      .select()
      .single();

    if (error) {
      console.error('[PATCH /api/product-images/:id] Error:', error);
      return serverErrorResponse('Failed to update product image');
    }

    // Log activity if admin
    if (isAdmin) {
      await logActivity({
        admin_id: userId,
        action: 'update_product_image',
        meta: {
          image_id: params.id,
          product_id: product.id,
          product_name: product.name,
          changes: payload,
        },
      });
    }

    return successResponse(data, 'Product image updated successfully');
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * DELETE /api/product-images/:id
 * Delete product image (owner or admin)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireAuth(request);
    if (!authResult) {
      return unauthorizedResponse('Authentication required');
    }
    const { userId, isAdmin } = authResult;

    // Get current image with product info
    const { data: currentImage, error: fetchError } = await supabaseAdmin
      .from('product_images')
      .select('*, products!inner(id, seller_id, name)')
      .eq('id', params.id)
      .single();

    if (fetchError || !currentImage) {
      return notFoundResponse('Product image not found');
    }

    // Only owner or admin can delete
    const product = currentImage.products as any;
    if (product.seller_id !== userId && !isAdmin) {
      return errorResponse('You can only delete images of your own products', 403);
    }

    const { error } = await supabaseAdmin
      .from('product_images')
      .delete()
      .eq('id', params.id);

    if (error) {
      console.error('[DELETE /api/product-images/:id] Error:', error);
      return serverErrorResponse('Failed to delete product image');
    }

    // Log activity if admin
    if (isAdmin) {
      await logActivity({
        admin_id: userId,
        action: 'delete_product_image',
        meta: {
          image_id: params.id,
          product_id: product.id,
          product_name: product.name,
          image_url: currentImage.image_url,
        },
      });
    }

    return successResponse(null, 'Product image deleted successfully');
  } catch (error) {
    return handleApiError(error);
  }
}
