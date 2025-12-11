"use server"

import { createServerSupabaseClient } from '@/lib/supabase/server'

/**
 * Update user's OneSignal player ID in profile
 */
export async function updateUserPlayerId(playerId: string) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return { success: false, error: 'User not authenticated' }
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ onesignal_player_id: playerId } as any)
      .eq('user_id', user.id)

    if (updateError) {
      console.error('Error updating player ID:', updateError)
      return { success: false, error: updateError.message }
    }

    return { success: true }
  } catch (error) {
    console.error('Error in updateUserPlayerId:', error)
    return { success: false, error: 'Failed to update player ID' }
  }
}
