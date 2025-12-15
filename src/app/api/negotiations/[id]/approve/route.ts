import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/api/_core/supabase-server'
import { requireAdmin } from '@/api/_core/auth'
import { successResponse, errorResponse, notFoundResponse } from '@/api/_core/response'
import { handleApiError } from '@/api/_core/error'
import { logActivity } from '@/api/_core/activity-logger'
import { createPricingSnapshot } from '@/lib/services/pricing-service'
import { canApprove } from '@/lib/utils/negotiation-state-machine'

// POST /api/negotiations/[id]/approve - Approve negotiation (SYSTEM PRICE ONLY)
// Admin can only approve or reject - system determines the final price

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

    // Fetch product separately
    const { data: product } = await supabaseAdmin
      .from('products')
      .select('id, name, seller_id, base_price, selling_price, min_nego_price, max_nego_price')
      .eq('id', negotiation.product_id)
      .single()

    if (!product) {
      return notFoundResponse('Product not found')
    }

    // Use state machine for validation
    if (!canApprove(negotiation.status)) {
      return errorResponse(`Cannot approve negotiation from status: ${negotiation.status}`, 400)
    }

    // SYSTEM DETERMINES FINAL PRICE - Admin cannot input custom price
    // If there's a counter_price, use that; otherwise use offer_price
    const finalPrice = negotiation.counter_price || negotiation.offer_price

    // Update negotiation with system-determined price
    const { data: updated, error: updateError } = await supabaseAdmin
      .from('negotiations')
      .update({
        status: 'approved',
        final_price: finalPrice,
        admin_id: auth.userId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.id)
      .eq('status', negotiation.status) // Optimistic locking
      .select()
      .single()

    if (updateError || !updated) {
      return errorResponse('Failed to approve negotiation. It may have been modified.', 409)
    }

    // Create notification for buyer
    await supabaseAdmin
      .from('notifications')
      .insert({
        user_id: negotiation.buyer_id,
        type: 'negotiation_approved',
        title: 'Negotiation Approved',
        message: `Your offer for ${product.name} has been approved at Rp ${finalPrice.toLocaleString('id-ID')}`,
      })

    // Create pricing snapshot for audit
    const pricingSnapshot = createPricingSnapshot(
      product.base_price,
      product.selling_price,
      product.min_nego_price,
      product.max_nego_price,
      {
        offerPrice: negotiation.offer_price,
        counterPrice: negotiation.counter_price,
        finalPrice: finalPrice,
      }
    )

    // Log activity with pricing snapshot
    await logActivity({
      admin_id: auth.userId,
      action: 'NEGOTIATION_APPROVED',
      meta: { 
        negotiation_id: params.id,
        product_id: negotiation.product_id,
        buyer_id: negotiation.buyer_id,
        final_price: finalPrice,
        pricing_snapshot: pricingSnapshot,
        note: 'Admin approved system-determined price',
      },
    })

    // TODO: Trigger OneSignal notification to buyer

    return successResponse(
      { 
        ...updated, 
        final_price: finalPrice,
        message: 'Negotiation approved with system-determined price' 
      }, 
      'Negotiation approved successfully'
    )
  } catch (error) {
    return handleApiError(error)
  }
}
