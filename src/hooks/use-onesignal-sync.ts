"use client"

import { useEffect } from 'react'
import { updateUserPlayerId } from '@/lib/actions/onesignal-actions'

/**
 * Hook to sync OneSignal player ID with user profile
 * Should be used in authenticated pages/layouts
 */
export function useOneSignalSync() {
  useEffect(() => {
    const syncPlayerId = async () => {
      // Wait for OneSignal to initialize
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // Get player ID from localStorage
      const playerId = localStorage.getItem('onesignal_player_id')
      
      if (playerId) {
        console.log('Syncing OneSignal player ID:', playerId)
        const result = await updateUserPlayerId(playerId)
        
        if (result.success) {
          console.log('Player ID synced successfully')
        } else {
          console.error('Failed to sync player ID:', result.error)
        }
      }
    }

    // Only run in browser and when user is authenticated
    if (typeof window !== 'undefined') {
      syncPlayerId()
    }
  }, [])
}
