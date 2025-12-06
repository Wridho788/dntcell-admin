import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient, isUserAdmin, getCurrentUser } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  try {
    // Check admin authentication
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      )
    }

    const isAdmin = await isUserAdmin(user.id)
    if (!isAdmin) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { appId, apiKey } = body

    if (!appId || !apiKey) {
      return NextResponse.json(
        { error: "App ID and API Key are required" },
        { status: 400 }
      )
    }

    // Send test notification
    const notificationData = {
      app_id: appId,
      headings: { en: "🔔 Test Notification" },
      contents: {
        en: "OneSignal integration is working correctly! You will receive notifications for new negotiations."
      },
      data: {
        type: "test_notification",
        timestamp: new Date().toISOString(),
      },
      // Send to all admins
      filters: [
        { field: "tag", key: "user_role", relation: "=", value: "admin" }
      ],
    }

    const oneSignalResponse = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${apiKey}`,
      },
      body: JSON.stringify(notificationData),
    })

    const oneSignalResult = await oneSignalResponse.json()

    if (!oneSignalResponse.ok) {
      console.error("OneSignal error:", oneSignalResult)
      return NextResponse.json(
        { error: `OneSignal API error: ${oneSignalResult.errors?.[0] || "Unknown error"}` },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message: "Test notification sent successfully",
      result: {
        id: oneSignalResult.id,
        recipients: oneSignalResult.recipients,
      },
    })

  } catch (error: any) {
    console.error("Error sending test notification:", error)
    return NextResponse.json(
      { error: "Failed to send test notification" },
      { status: 500 }
    )
  }
}
