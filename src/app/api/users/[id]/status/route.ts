import { NextRequest } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/api/_core/supabase-server'
import { requireAdmin } from '@/api/_core/auth'
import { successResponse, errorResponse, notFoundResponse } from '@/api/_core/response'
import { parseRequestBody } from '@/api/_core/validator'
import { handleApiError } from '@/api/_core/error'
import { logActivity } from '@/api/_core/activity-logger'

// PATCH /api/users/[id]/status - Update user status (activate/deactivate)
const updateStatusSchema = z.object({
  is_active: z.boolean(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireAdmin(request)
    if ('userId' in authResult === false) {
      return authResult // Return error response
    }
    const auth = authResult

    const validation = await parseRequestBody(request, updateStatusSchema)
    if (!validation.success) {
      return errorResponse(validation.error, 422)
    }

    // Check if user exists
    const { data: existingUser, error: fetchError } = await supabaseAdmin
      .from('profiles')
      .select('user_id, full_name, email, is_active')
      .eq('user_id', params.id)
      .single()

    if (fetchError || !existingUser) {
      return notFoundResponse('User not found')
    }

    // Update user status
    const { data: updated, error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({
        is_active: validation.data.is_active,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', params.id)
      .select()
      .single()

    if (updateError) {
      return errorResponse(updateError.message)
    }

    // Log activity
    await logActivity({
      admin_id: auth.userId,
      action: validation.data.is_active ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
      meta: {
        user_id: params.id,
        user_name: existingUser.full_name || existingUser.email,
        from_status: existingUser.is_active,
        to_status: validation.data.is_active,
      },
    })

    return successResponse(
      updated,
      `User ${validation.data.is_active ? 'activated' : 'deactivated'} successfully`
    )
  } catch (error) {
    return handleApiError(error)
  }
}
