import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient, isUserAdmin, getCurrentUser } from "@/lib/supabase/server"

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check authentication
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
      .from("negotiations")
      .select(`
        *,
        product:products(id, name, main_image_url, base_price, selling_price),
        buyer:users!negotiations_buyer_id_fkey(id, email, full_name)
      `)
      .eq("id", params.id)
      .single()

    if (error) {
      return NextResponse.json(
        { error: "Negotiation not found" },
        { status: 404 }
      )
    }

    return NextResponse.json(data)

  } catch (error: any) {
    console.error("Error fetching negotiation:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
