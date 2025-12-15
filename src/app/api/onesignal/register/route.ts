import { NextRequest } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/api/_core/supabase-server'
import { requireAuth } from '@/api/_core/auth'
import { successResponse, errorResponse, unauthorizedResponse } from '@/api/_core/response'
import { parseRequestBody } from '@/api/_core/validator'
import { handleApiError } from '@/api/_core/error'
import { logActivity } from '@/api/_core/activity-logger'

// Schema for registering player ID - SECURITY: userId comes from auth context, not body
const registerPlayerIdSchema = z.object({
  playerId: z.string().min(1),
})

/**
 * POST /api/onesignal/register
 * Register or update OneSignal player ID for authenticated user
 * SECURITY: Uses auth context to get userId - cannot register for other users
 */
export async function POST(request: NextRequest) {
  try {
    // SECURITY: Get userId from auth context, not from request body
    const auth = await requireAuth(request)
    if (!auth) {
      return unauthorizedResponse()
    }

    const userId = auth.userId

    // Validate request body
    const parseResult = await parseRequestBody(request, registerPlayerIdSchema)
    if (!parseResult.success) {
      return errorResponse(parseResult.error, 422)
    }

    const { playerId } = parseResult.data

    // SECURITY: Clear this player ID from any other user first (prevent device hijacking)
    await supabaseAdmin
      .from('profiles')
      .update({ onesignal_player_id: null })
      .eq('onesignal_player_id', playerId)
      .neq('user_id', userId)

    // Use upsert to handle both insert and update cases
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .upsert({ 
        user_id: userId,
        onesignal_player_id: playerId,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id',
      })
      .select()
      .single()

    if (error) {
      console.error('[OneSignal Register] Error:', error)
      return errorResponse('Failed to register player ID')
    }

    // Log activity for audit trail
    await logActivity({
      admin_id: userId,
      action: 'REGISTER_PLAYER_ID',
      meta: { 
        player_id: playerId,
        user_id: userId,
      },
    })

    console.log('[OneSignal Register] Success:', {
      userId,
      playerId,
    })

    return successResponse(
      { 
        userId, 
        playerId,
        registered: true,
      }, 
      'Player ID registered successfully'
    )
  } catch (error) {
    console.error('[OneSignal Register] Unexpected error:', error)
    return handleApiError(error)
  }
}
