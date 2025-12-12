import { NextRequest } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/api/_core/supabase-server'
import { successResponse, errorResponse } from '@/api/_core/response'
import { parseRequestBody } from '@/api/_core/validator'
import { handleApiError } from '@/api/_core/error'

// Schema for registering player ID
const registerPlayerIdSchema = z.object({
  adminId: z.string().uuid(),
  playerId: z.string().min(1),
})

/**
 * POST /api/onesignal/register
 * Register or update OneSignal player ID for admin user
 */
export async function POST(request: NextRequest) {
  try {
    // Validate request body
    const parseResult = await parseRequestBody(request, registerPlayerIdSchema)
    if (!parseResult.success) {
      return errorResponse(parseResult.error, 422)
    }

    const { adminId, playerId } = parseResult.data

    // Verify user exists
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('user_id, role')
      .eq('user_id', adminId)
      .single()

    if (profileError || !profile) {
      return errorResponse('User not found', 404)
    }

    // Update or insert player ID
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update({ 
        onesignal_player_id: playerId,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', adminId)
      .select()
      .single()

    if (error) {
      console.error('[OneSignal Register] Error:', error)
      return errorResponse('Failed to register player ID')
    }

    console.log('[OneSignal Register] Success:', {
      adminId,
      playerId,
      role: profile.role,
    })

    return successResponse(
      { 
        adminId, 
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
