import { NextRequest } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/api/_core/supabase-server'
import { requireAdmin } from '@/api/_core/auth'
import { successResponse, errorResponse, notFoundResponse } from '@/api/_core/response'
import { parseRequestBody } from '@/api/_core/validator'
import { handleApiError } from '@/api/_core/error'
import { logActivity } from '@/api/_core/activity-logger'
import { canReject } from '@/lib/utils/negotiation-state-machine'
import { sendUserNotification } from '@/lib/notifications/notification-helper'

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

    // Get negotiation - manual join to avoid FK issues
    const { data: negotiation, error: fetchError } = await supabaseAdmin
      .from('negotiations')
      .select('*')
      .eq('id', params.id)
      .single()

    if (fetchError || !negotiation) {
      return notFoundResponse('Negotiation not found')
    }

    // Fetch product separately
    const { data: product } = await supabaseAdmin
      .from('products')
      .select('id, name')
      .eq('id', negotiation.product_id)
      .single()

    if (!product) {
      return notFoundResponse('Product not found')
    }

    // Use state machine for validation
    if (!canReject(negotiation.status)) {
      return errorResponse(`Cannot reject negotiation from status: ${negotiation.status}`, 400)
    }

    // Update negotiation with row-level lock (optimistic locking)
    const { data: updated, error: updateError } = await supabaseAdmin
      .from('negotiations')
      .update({
        status: 'rejected',
        admin_id: auth.userId,
        note: validation.data.note,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.id)
      .eq('status', negotiation.status) // Optimistic locking
      .select()
      .single()

    if (updateError || !updated) {
      return errorResponse('Failed to update negotiation. It may have been modified.', 409)
    }

    // Send notification to buyer (DB + Push)
    const message = validation.data.note 
      ? `Your offer for ${product.name} has been rejected: ${validation.data.note}`
      : `Your offer for ${product.name} has been rejected`
    
    await sendUserNotification({
      userId: negotiation.buyer_id,
      type: 'negotiation_rejected',
      title: 'Negotiation Rejected ❌',
      message,
      data: { 
        negotiation_id: params.id, 
        type: 'negotiation_rejected',
        note: validation.data.note,
      },
    })

    // Log activity
    await logActivity({
      admin_id: auth.userId,
      action: 'NEGOTIATION_REJECTED',
      meta: { 
        negotiation_id: params.id,
        product_id: negotiation.product_id,
        buyer_id: negotiation.buyer_id,
        from_status: negotiation.status,
        to_status: 'rejected',
        note: validation.data.note,
      },
    })

    return successResponse(updated, 'Negotiation rejected')
  } catch (error) {
    return handleApiError(error)
  }
}
