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

    const supabase = await createServerSupabaseClient()

    // Store in a settings table or use Supabase secrets
    // For now, we'll use a simple settings table approach
    const { error: upsertError } = await supabase
      .from("settings")
      .upsert({
        key: "onesignal_config",
        value: { appId, apiKey },
        updated_at: new Date().toISOString(),
      }, {
        onConflict: "key"
      })

    if (upsertError) {
      console.error("Error saving settings:", upsertError)
      return NextResponse.json(
        { error: "Failed to save settings" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: "OneSignal settings saved successfully",
    })

  } catch (error: any) {
    console.error("Error in OneSignal settings API:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
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

    const supabase = await createServerSupabaseClient()

    const { data, error } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "onesignal_config")
      .single()

    if (error && error.code !== "PGRST116") { // PGRST116 = not found
      console.error("Error fetching settings:", error)
      return NextResponse.json(
        { error: "Failed to fetch settings" },
        { status: 500 }
      )
    }

    const result = data as any

    return NextResponse.json({
      success: true,
      data: result?.value || null,
    })

  } catch (error: any) {
    console.error("Error in OneSignal settings API:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
