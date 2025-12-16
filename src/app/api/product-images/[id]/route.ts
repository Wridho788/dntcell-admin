import { NextRequest } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin, isUserAdmin } from '@/api/_core/supabase-server';
import { successResponse, errorResponse, validationErrorResponse, serverErrorResponse, notFoundResponse, unauthorizedResponse } from '@/api/_core/response';
import { requireAuth } from '@/api/_core/auth';
import { parseRequestBody } from '@/api/_core/validator';
import { handleApiError } from '@/api/_core/error';
import { logActivity } from '@/api/_core/activity-logger';

// Schema for updating product image - aligned with DB schema
const updateProductImageSchema = z.object({
  sort_order: z.number().int().min(0).optional(),
  is_primary: z.boolean().optional(),
});

/**
 * GET /api/product-images/:id
 * Get single product image (with ownership verification)
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
    const { userId, isAdmin } = authResult;

    // Get image with product info for ownership check
    const { data, error } = await supabaseAdmin
      .from('product_images')
      .select(`
        *,
        products!inner(
          id,
          seller_id
        )
      `)
      .eq('id', params.id)
      .single();

    if (error || !data) {
      return notFoundResponse('Product image not found');
    }

    // Authorization: only owner or admin can view image details
    const product = data.products as { id: string; seller_id: string };
    if (!isAdmin && product.seller_id !== userId) {
      return errorResponse('You can only view images of your own products', 403);
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

    // Get current image with product info - explicit select for type safety
    const { data: currentImage, error: fetchError } = await supabaseAdmin
      .from('product_images')
      .select(`
        id,
        product_id,
        url,
        products!inner(
          id,
          seller_id,
          name
        )
      `)
      .eq('id', params.id)
      .single()

    if (fetchError || !currentImage) {
      return notFoundResponse('Product image not found');
    }

    // Type-safe product access - Supabase returns nested object, not array
    const product = currentImage.products as unknown as { id: string; seller_id: string; name: string };
    if (product.seller_id !== userId && !isAdmin) {
      return errorResponse('You can only update images of your own products', 403);
    }

    // If setting as primary image, unset other primary images
    if (payload.is_primary === true) {
      await supabaseAdmin
        .from('product_images')
        .update({ is_primary: false })
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

    // Get current image with product info - explicit select for type safety
    const { data: currentImage, error: fetchError } = await supabaseAdmin
      .from('product_images')
      .select(`
        id,
        product_id,
        url,
        products!inner(
          id,
          seller_id,
          name
        )
      `)
      .eq('id', params.id)
      .single()

    if (fetchError || !currentImage) {
      return notFoundResponse('Product image not found');
    }

    // Type-safe product access - Supabase returns nested object, not array
    const product = currentImage.products as unknown as { id: string; seller_id: string; name: string };
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

    // TODO: Delete physical file from Supabase Storage
    // Extract path from currentImage.url and call:
    // await supabaseAdmin.storage.from('product-images').remove([filePath])
    // This prevents storage leaks and orphaned files

    // Log activity if admin
    if (isAdmin) {
      await logActivity({
        admin_id: userId,
        action: 'delete_product_image',
        meta: {
          image_id: params.id,
          product_id: product.id,
          product_name: product.name,
          image_url: currentImage.url,
        },
      });
    }

    return successResponse(null, 'Product image deleted successfully');
  } catch (error) {
    return handleApiError(error);
  }
}
