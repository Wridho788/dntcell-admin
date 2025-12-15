import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/api/_core/supabase-server'
import { requireAdmin } from '@/api/_core/auth'
import { successResponse, errorResponse, notFoundResponse } from '@/api/_core/response'
import { handleApiError } from '@/api/_core/error'
import { logActivity } from '@/api/_core/activity-logger'
import { 
  generateCounterOffer, 
  validateNegotiationAttempt,
  createPricingSnapshot 
} from '@/lib/services/pricing-service'

// POST /api/negotiations/[id]/counter - System generates counter offer
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

    // Get negotiation
    const { data: negotiation, error: fetchError } = await supabaseAdmin
      .from('negotiations')
      .select(`
        *,
        product:products(id, name, base_price, selling_price, min_nego_price, max_nego_price, category:categories(name)),
        buyer:profiles(user_id, onesignal_player_id)
      `)
      .eq('id', params.id)
      .single()

    if (fetchError || !negotiation) {
      return notFoundResponse('Negotiation not found')
    }

    if (negotiation.status !== 'pending' && negotiation.status !== 'countered') {
      return errorResponse('Negotiation cannot be countered from current status', 400)
    }

    // Count previous counter attempts
    const currentAttempts = negotiation.counter_price ? 1 : 0 // Simplified - you may want to track this better

    // Validate negotiation attempt count
    const attemptValidation = await validateNegotiationAttempt(
      negotiation.product_id,
      currentAttempts
    )

    if (!attemptValidation.valid) {
      return errorResponse(attemptValidation.reason || 'Maximum negotiation attempts reached', 400)
    }

    // Generate system counter offer (SYSTEM-CONTROLLED)
    const counterPrice = await generateCounterOffer(
      negotiation.product_id,
      negotiation.offer_price,
      currentAttempts + 1
    )

    // Update negotiation with system-generated counter
    const { data: updated, error: updateError } = await supabaseAdmin
      .from('negotiations')
      .update({
        status: 'countered',
        counter_price: counterPrice,
        admin_id: auth.userId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.id)
      .select()
      .single()

    if (updateError) {
      return errorResponse(updateError.message)
    }

    // Create notification for buyer
    const product = negotiation.product as any
    await supabaseAdmin
      .from('notifications')
      .insert({
        user_id: negotiation.buyer_id,
        type: 'negotiation_countered',
        title: 'Counter Offer Received',
        message: `Admin countered your offer for ${product.name} with ${counterPrice.toLocaleString('id-ID')}`,
        data: { negotiation_id: params.id, counter_price: counterPrice },
      })

    // Create pricing snapshot for audit
    const pricingSnapshot = createPricingSnapshot(
      product.base_price,
      product.selling_price,
      product.min_nego_price,
      product.max_nego_price,
      {
        offerPrice: negotiation.offer_price,
        counterPrice: counterPrice,
      }
    )

    // Log activity with pricing snapshot
    await logActivity({
      admin_id: auth.userId,
      action: 'COUNTER_NEGOTIATION',
      meta: { 
        negotiation_id: params.id,
        product_id: negotiation.product_id,
        user_offer: negotiation.offer_price,
        system_counter: counterPrice,
        pricing: pricingSnapshot,
      },
    })

    return successResponse(
      { 
        negotiation: updated, 
        counter_price: counterPrice,
        message: 'System-generated counter offer sent successfully'
      }, 
      'Counter offer generated'
    )
  } catch (error) {
    return handleApiError(error)
  }
}
