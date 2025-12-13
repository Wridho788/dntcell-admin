"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

interface OneSignalClientProps {
  adminId?: string
}

export function OneSignalClient({ adminId }: OneSignalClientProps) {
  const [isInitialized, setIsInitialized] = useState(false)
  const router = useRouter()

  useEffect(() => {
    // Only run on client side
    if (typeof window === "undefined") return

    // Load OneSignal script
    const loadOneSignal = async () => {
      try {
        // Check if script already loaded
        if (window.OneSignal) {
          console.log("[OneSignal] SDK already loaded")
          await initializeOneSignal()
          return
        }

        // Load OneSignal SDK
        const script = document.createElement("script")
        script.src = "https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js"
        script.async = true
        script.defer = true
        
        script.onload = async () => {
          console.log("[OneSignal] SDK loaded successfully")
          await initializeOneSignal()
        }

        script.onerror = (error) => {
          console.error("[OneSignal] Failed to load SDK:", error)
        }

        document.head.appendChild(script)
      } catch (error) {
        console.error("[OneSignal] Error loading SDK:", error)
      }
    }

    const initializeOneSignal = async () => {
      try {
        // Get environment variable on client side
        const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID
        
        if (!appId || appId === 'undefined' || appId === '') {
          console.warn("[OneSignal] NEXT_PUBLIC_ONESIGNAL_APP_ID not configured, skipping initialization")
          return
        }

        // Check if OneSignal is available
        if (!window.OneSignal) {
          console.error("[OneSignal] SDK not loaded")
          return
        }

        // Initialize OneSignal
        await window.OneSignal.init({
          appId: appId,
          allowLocalhostAsSecureOrigin: true,
        })

        console.log("[OneSignal] Initialized successfully")
        setIsInitialized(true)

        // Request notification permission
        const permission = await window.OneSignal.Notifications.requestPermission()
        console.log("[OneSignal] Permission status:", permission)

        // Listen for subscription changes
        window.OneSignal.User.PushSubscription.addEventListener("change", async (event: any) => {
          console.log("[OneSignal] Subscription changed:", event)
          
          if (event.current.id) {
            const playerId = event.current.id
            console.log("[OneSignal] New Player ID:", playerId)
            
            // Register player ID with backend
            if (adminId) {
              await registerPlayerId(adminId, playerId)
            }
          }
        })

        // Get current player ID
        const playerId = await window.OneSignal.User.PushSubscription.id
        if (playerId && adminId) {
          console.log("[OneSignal] Current Player ID:", playerId)
          await registerPlayerId(adminId, playerId)
        }

      } catch (error) {
        console.error("[OneSignal] Initialization error:", error)
      }
    }

    const registerPlayerId = async (adminId: string, playerId: string) => {
      try {
        console.log("[OneSignal] Registering player ID:", { adminId, playerId })
        
        const response = await fetch("/api/onesignal/register", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            adminId,
            playerId,
          }),
        })

        if (!response.ok) {
          const error = await response.json()
          console.error("[OneSignal] Registration failed:", error)
          return
        }

        const result = await response.json()
        console.log("[OneSignal] Registration successful:", result)
      } catch (error) {
        console.error("[OneSignal] Registration error:", error)
      }
    }

    loadOneSignal()
  }, [adminId, router])

  return null
}
