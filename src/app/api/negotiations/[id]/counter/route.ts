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
import { canCounter } from '@/lib/utils/negotiation-state-machine'
import { sendUserNotification } from '@/lib/onesignal'

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

    // Get negotiation - manual join to avoid FK issues
    const { data: negotiation, error: fetchError } = await supabaseAdmin
      .from('negotiations')
      .select('*')
      .eq('id', params.id)
      .single()

    if (fetchError || !negotiation) {
      return notFoundResponse('Negotiation not found')
    }

    // Fetch product and category separately
    const { data: product } = await supabaseAdmin
      .from('products')
      .select('id, name, base_price, selling_price, min_nego_price, max_nego_price, category_id')
      .eq('id', negotiation.product_id)
      .single()

    if (!product) {
      return notFoundResponse('Product not found')
    }

    const { data: category } = await supabaseAdmin
      .from('categories')
      .select('name')
      .eq('id', product.category_id)
      .single()

    // Use state machine for validation
    if (!canCounter(negotiation.status)) {
      return errorResponse(`Cannot counter negotiation from status: ${negotiation.status}`, 400)
    }

    // Get current counter attempt from database field
    const currentAttempts = negotiation.counter_attempt || 0

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
        counter_attempt: currentAttempts + 1,
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
    await supabaseAdmin
      .from('notifications')
      .insert({
        user_id: negotiation.buyer_id,
        type: 'negotiation_countered',
        title: 'Counter Offer Received',
        message: `Admin countered your offer for ${product.name} with Rp ${counterPrice.toLocaleString('id-ID')}`,
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
      action: 'NEGOTIATION_COUNTERED',
      meta: { 
        negotiation_id: params.id,
        product_id: negotiation.product_id,
        buyer_id: negotiation.buyer_id,
        user_offer: negotiation.offer_price,
        system_counter: counterPrice,
        counter_attempt: currentAttempts + 1,
        pricing_snapshot: pricingSnapshot,
        note: 'System-generated counter offer',
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
