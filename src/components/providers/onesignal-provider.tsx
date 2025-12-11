"use client"

import { useEffect } from "react"
import OneSignal from "react-onesignal"

export function OneSignalProvider() {
  useEffect(() => {
    async function initOneSignal() {
      try {
        // Initialize OneSignal
        await OneSignal.init({
          appId: process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID!,
          allowLocalhostAsSecureOrigin: true,
        })

        // Request notification permission
        const permission = await OneSignal.Notifications.requestPermission()
        console.log('OneSignal permission:', permission)

        // Get player ID after initialization
        const playerId = await OneSignal.User.PushSubscription.id
        if (playerId) {
          console.log('OneSignal Player ID:', playerId)
          // Store player ID in localStorage for later use
          localStorage.setItem('onesignal_player_id', playerId)
        }

        // Listen for subscription changes
        OneSignal.User.PushSubscription.addEventListener('change', (subscription) => {
          console.log('OneSignal subscription changed:', subscription)
          if (subscription.current.id) {
            localStorage.setItem('onesignal_player_id', subscription.current.id)
          }
        })
      } catch (error) {
        console.error('Error initializing OneSignal:', error)
      }
    }

    // Only initialize in browser
    if (typeof window !== 'undefined') {
      initOneSignal()
    }
  }, [])

  return null
}
