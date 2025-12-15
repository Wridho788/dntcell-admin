import { NextRequest } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/api/_core/supabase-server'
import { requireAdmin } from '@/api/_core/auth'
import { successResponse, errorResponse, notFoundResponse } from '@/api/_core/response'
import { parseRequestBody } from '@/api/_core/validator'
import { handleApiError } from '@/api/_core/error'
import { logActivity } from '@/api/_core/activity-logger'

// POST /api/negotiations/[id]/approve - Approve negotiation
const approveSchema = z.object({
  final_price: z.number().positive(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireAdmin(request)
    if ('userId' in authResult === false) {
      return authResult // Return error response
    }
    const auth = authResult

    const validation = await parseRequestBody(request, approveSchema)
    if (!validation.success) {
      return errorResponse(validation.error, 422)
    }

    // Get negotiation
    const { data: negotiation, error: fetchError } = await supabaseAdmin
      .from('negotiations')
      .select(`
        *,
        product:products(id, name, seller_id),
        buyer:profiles(user_id, onesignal_player_id)
      `)
      .eq('id', params.id)
      .single()

    if (fetchError || !negotiation) {
      return notFoundResponse('Negotiation not found')
    }

    if (negotiation.status !== 'pending') {
      return errorResponse('Negotiation is not pending', 400)
    }

    // Update negotiation
    const { data: updated, error: updateError } = await supabaseAdmin
      .from('negotiations')
      .update({
        status: 'approved',
        final_price: validation.data.final_price,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.id)
      .select()
      .single()

    if (updateError) {
      return errorResponse(updateError.message)
    }

    // Create notification for buyer
    await supabaseAdmin
      .from('notifications')
      .insert({
        user_id: negotiation.buyer_id,
        type: 'negotiation_approved',
        title: 'Negotiation Approved',
        message: `Your offer for ${negotiation.product.name} has been approved at ${validation.data.final_price}`,
        data: { negotiation_id: params.id, final_price: validation.data.final_price },
      })

    // Log activity
    await logActivity({
      admin_id: auth.userId,
      action: 'APPROVE_NEGOTIATION',
      meta: { 
        negotiation_id: params.id,
        product_id: negotiation.product_id,
        final_price: validation.data.final_price,
      },
    })

    // TODO: Trigger OneSignal notification to buyer

    return successResponse(updated, 'Negotiation approved successfully')
  } catch (error) {
    return handleApiError(error)
  }
}
