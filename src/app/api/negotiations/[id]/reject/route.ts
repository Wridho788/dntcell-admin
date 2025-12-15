import { NextRequest } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/api/_core/supabase-server'
import { requireAdmin } from '@/api/_core/auth'
import { successResponse, errorResponse, notFoundResponse } from '@/api/_core/response'
import { parseRequestBody } from '@/api/_core/validator'
import { handleApiError } from '@/api/_core/error'
import { logActivity } from '@/api/_core/activity-logger'
import { NegotiationStatus, isValidTransition } from '@/lib/domain/negotiation-states'

// POST /api/negotiations/[id]/reject - Reject negotiation
const rejectSchema = z.object({
  note: z.string().optional(),
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

    const validation = await parseRequestBody(request, rejectSchema)
    if (!validation.success) {
      return errorResponse(validation.error, 422)
    }

    // Get negotiation
    const { data: negotiation, error: fetchError } = await supabaseAdmin
      .from('negotiations')
      .select(`
        *,
        product:products(id, name),
        buyer:profiles!negotiations_buyer_id_fkey(user_id, onesignal_player_id)
      `)
      .eq('id', params.id)
      .single()

    if (fetchError || !negotiation) {
      return notFoundResponse('Negotiation not found')
    }

    // Validate state transition
    if (!isValidTransition(negotiation.status, NegotiationStatus.REJECTED)) {
      return errorResponse(`Cannot reject from status: ${negotiation.status}`, 400)
    }

    // Update negotiation with row-level lock
    const { data: updated, error: updateError } = await supabaseAdmin
      .from('negotiations')
      .update({
        status: NegotiationStatus.REJECTED,
        admin_id: auth.userId,
        note: validation.data.note,
      })
      .eq('id', params.id)
      .eq('status', negotiation.status) // Optimistic locking
      .select()
      .single()

    if (updateError || !updated) {
      return errorResponse('Failed to update negotiation. It may have been modified.', 409)
    }

    // Create notification for buyer
    await supabaseAdmin
      .from('notifications')
      .insert({
        user_id: negotiation.user_id,
        type: 'negotiation_rejected',
        title: 'Negotiation Rejected',
        message: `Your offer for ${negotiation.product.name} has been rejected`,
        data: { negotiation_id: params.id, note: validation.data.note },
      })

    // Log activity
    await logActivity({
      admin_id: auth.userId,
      action: 'REJECT_NEGOTIATION',
      meta: { 
        negotiation_id: params.id,
        product_id: negotiation.product_id,
        from_status: negotiation.status,
        to_status: NegotiationStatus.REJECTED,
      },
    })

    // TODO: Trigger OneSignal notification to buyer

    return successResponse(updated, 'Negotiation rejected')
  } catch (error) {
    return handleApiError(error)
  }
}
