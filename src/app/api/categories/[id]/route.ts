import { NextRequest } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/api/_core/supabase-server'
import { requireAuth } from '@/api/_core/auth'
import { successResponse, errorResponse, unauthorizedResponse, notFoundResponse } from '@/api/_core/response'
import { parseRequestBody } from '@/api/_core/validator'
import { handleApiError } from '@/api/_core/error'
import { logActivity } from '@/api/_core/activity-logger'

// GET /api/categories/[id] - Get category details
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { data: category, error } = await supabaseAdmin
      .from('categories')
      .select('*')
      .eq('id', params.id)
      .single()

    if (error || !category) {
      return notFoundResponse('Category not found')
    }

    return successResponse(category)
  } catch (error) {
    return handleApiError(error)
  }
}

// PATCH /api/categories/[id] - Update category (admin only)
const updateCategorySchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAuth(request)
    if (!auth) {
      return unauthorizedResponse()
    }

    if (!auth.isAdmin) {
      return errorResponse('Admin access required', 403)
    }

    const validation = await parseRequestBody(request, updateCategorySchema)
    if (!validation.success) {
      return errorResponse(validation.error, 422)
    }

    const { data: category, error } = await supabaseAdmin
      .from('categories')
      .update(validation.data)
      .eq('id', params.id)
      .select()
      .single()

    if (error) {
      return errorResponse(error.message)
    }

    await logActivity({
      admin_id: auth.userId,
      action: 'UPDATE_CATEGORY',
      meta: { category_id: params.id },
    })

    return successResponse(category, 'Category updated successfully')
  } catch (error) {
    return handleApiError(error)
  }
}

// DELETE /api/categories/[id] - Delete category (admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAuth(request)
    if (!auth) {
      return unauthorizedResponse()
    }

    if (!auth.isAdmin) {
      return errorResponse('Admin access required', 403)
    }

    const { error } = await supabaseAdmin
      .from('categories')
      .delete()
      .eq('id', params.id)

    if (error) {
      return errorResponse(error.message)
    }

    await logActivity({
      admin_id: auth.userId,
      action: 'DELETE_CATEGORY',
      meta: { category_id: params.id },
    })

    return successResponse(null, 'Category deleted successfully')
  } catch (error) {
    return handleApiError(error)
  }
}
