import { NextRequest } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/api/_core/supabase-server'
import { requireAuth } from '@/api/_core/auth'
import { successResponse, errorResponse, unauthorizedResponse } from '@/api/_core/response'
import { parseRequestBody } from '@/api/_core/validator'
import { handleApiError } from '@/api/_core/error'
import { logActivity } from '@/api/_core/activity-logger'

// GET /api/categories - List all categories
export async function GET(request: NextRequest) {
  try {
    const { data, error } = await supabaseAdmin
      .from('categories')
      .select('*')
      .order('name', { ascending: true })

    if (error) {
      return errorResponse(error.message)
    }

    return successResponse({ categories: data })
  } catch (error) {
    return handleApiError(error)
  }
}

// POST /api/categories - Create new category (admin only)
const createCategorySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (!auth) {
      return unauthorizedResponse()
    }

    if (!auth.isAdmin) {
      return errorResponse('Admin access required', 403)
    }

    const validation = await parseRequestBody(request, createCategorySchema)
    if (!validation.success) {
      return errorResponse(validation.error, 422)
    }

    const { data: category, error } = await supabaseAdmin
      .from('categories')
      .insert(validation.data)
      .select()
      .single()

    if (error) {
      return errorResponse(error.message)
    }

    await logActivity({
      admin_id: auth.userId,
      action: 'CREATE_CATEGORY',
      meta: { category_id: category.id, name: category.name },
    })

    return successResponse(category, 'Category created successfully', 201)
  } catch (error) {
    return handleApiError(error)
  }
}
