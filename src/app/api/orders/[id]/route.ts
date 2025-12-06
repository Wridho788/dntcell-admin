import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient, getCurrentUser, isUserAdmin } from "@/lib/supabase/server"

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      )
    }

    const hasAdminAccess = await isUserAdmin(user.id)
    if (!hasAdminAccess) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      )
    }

    const supabase = await createServerSupabaseClient()

    const { data: order, error } = await supabase
      .from("orders")
      .select(`
        *,
        product:products(id, name, main_image_url, base_price, selling_price, condition),
        buyer:users!orders_buyer_id_fkey(id, email, full_name),
        negotiation:negotiations(id, offer_price, status, note)
      `)
      .eq("id", params.id)
      .single()

    if (error) {
      return NextResponse.json(
        { error: `Failed to fetch order: ${error.message}` },
        { status: 500 }
      )
    }

    if (!order) {
      return NextResponse.json(
        { error: "Order not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({ order })
  } catch (error: any) {
    console.error("Error fetching order:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}
