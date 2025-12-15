"use server"

import { revalidatePath } from "next/cache"
import {
  createServerSupabaseClient,
  getCurrentUser,
  isUserAdmin,
} from "@/lib/supabase/server"
import {
  createNegotiationSchema,
  updateNegotiationStatusSchema,
  counterOfferSchema,
  negotiationSearchSchema,
  type Negotiation,
  type CreateNegotiationInput,
  type UpdateNegotiationStatusInput,
  type CounterOfferInput,
  type NegotiationSearch,
  type NegotiationWithDetails,
} from "@/lib/validations/negotiation"

// Types for server actions
type ActionResult<T = any> = {
  success: boolean
  data?: T
  error?: string
  errors?: Record<string, string[]>
}

// Helper function to check admin access
const requireAdminAccess = async (): Promise<string> => {
  const user = await getCurrentUser()
  if (!user) {
    throw new Error("Authentication required")
  }

  const hasAdminAccess = await isUserAdmin(user.id)
  if (!hasAdminAccess) {
    throw new Error("Admin access required")
  }

  return user.id
}

/**
 * Create a new negotiation (used by buyers in user app)
 */
export async function createNegotiation(
  data: CreateNegotiationInput
): Promise<ActionResult<Negotiation>> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return {
        success: false,
        error: "Authentication required",
      }
    }

    // Validate input
    const validationResult = createNegotiationSchema.safeParse(data)
    if (!validationResult.success) {
      return {
        success: false,
        error: "Validation failed",
        errors: validationResult.error.flatten().fieldErrors,
      }
    }

    const supabase = await createServerSupabaseClient()

    // Check if product exists and is negotiable
    const { data: products, error: productError } = await supabase
      .from("products")
      .select("id, negotiable, selling_price, status")
      .eq("id", validationResult.data.product_id)

    if (productError || !products || products.length === 0) {
      return {
        success: false,
        error: "Product not found",
      }
    }

    const product = products[0] as any

    if (!product.negotiable) {
      return {
        success: false,
        error: "This product is not open for negotiation",
      }
    }

    if (product.status === "sold") {
      return {
        success: false,
        error: "This product has already been sold",
      }
    }

    // Check if buyer already has a pending negotiation for this product
    const { data: existingNegotiation } = await supabase
      .from("negotiations")
      .select("id, status")
      .eq("product_id", validationResult.data.product_id)
      .eq("buyer_id", user.id)
      .eq("status", "pending")
      .single()

    if (existingNegotiation) {
      return {
        success: false,
        error: "You already have a pending negotiation for this product",
      }
    }

    // Create negotiation
    const { data: negotiation, error } = await supabase
      .from("negotiations")
      .insert({
        product_id: validationResult.data.product_id,
        buyer_id: user.id,
        offer_price: validationResult.data.offer_price,
        status: "pending",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) {
      console.error("Database error:", error)
      return {
        success: false,
        error: `Failed to create negotiation: ${error.message}`,
      }
    }

    revalidatePath("/products")
    revalidatePath(`/products/${validationResult.data.product_id}`)

    return {
      success: true,
      data: negotiation as any,
    }
  } catch (error: any) {
    console.error("Error creating negotiation:", error)
    return {
      success: false,
      error: error.message || "Failed to create negotiation",
    }
  }
}

/**
 * Get negotiations for a specific product (admin only)
 */
export async function getNegotiationsByProduct(
  productId: string
): Promise<ActionResult<NegotiationWithDetails[]>> {
  try {
    await requireAdminAccess()

    const supabase = await createServerSupabaseClient()

    const { data: negotiations, error } = await supabase
      .from("negotiations")
      .select(
        `
        *,
        product:products(id, name, main_image_url, base_price, selling_price),
        buyer:profiles(user_id, email, full_name)
      `
      )
      .eq("product_id", productId)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Database error:", error)
      return {
        success: false,
        error: `Failed to fetch negotiations: ${error.message}`,
      }
    }

    return {
      success: true,
      data: negotiations as any,
    }
  } catch (error: any) {
    console.error("Error fetching negotiations:", error)
    return {
      success: false,
      error: error.message || "Failed to fetch negotiations",
    }
  }
}

/**
 * Get all negotiations with filters (admin only)
 */
export async function searchNegotiations(
  params: NegotiationSearch
): Promise<ActionResult<{ negotiations: NegotiationWithDetails[]; total: number }>> {
  try {
    await requireAdminAccess()

    const validationResult = negotiationSearchSchema.safeParse(params)
    if (!validationResult.success) {
      return {
        success: false,
        error: "Invalid search parameters",
        errors: validationResult.error.flatten().fieldErrors,
      }
    }

    const { page, limit, sort_by, sort_order, product_id, buyer_id, status } =
      validationResult.data

    const supabase = await createServerSupabaseClient()

    // Build query
    let query = supabase
      .from("negotiations")
      .select(
        `
        *,
        product:products(id, name, main_image_url, base_price, selling_price),
        buyer:profiles(user_id, email, full_name)
      `,
        { count: "exact" }
      )

    // Apply filters
    if (product_id) {
      query = query.eq("product_id", product_id)
    }
    if (buyer_id) {
      query = query.eq("buyer_id", buyer_id)
    }
    if (status) {
      query = query.eq("status", status)
    }

    // Apply sorting
    query = query.order(sort_by, { ascending: sort_order === "asc" })

    // Apply pagination
    const from = (page - 1) * limit
    const to = from + limit - 1
    query = query.range(from, to)

    const { data: negotiations, error, count } = await query

    if (error) {
      console.error("Database error:", error)
      return {
        success: false,
        error: `Failed to search negotiations: ${error.message}`,
      }
    }

    return {
      success: true,
      data: {
        negotiations: negotiations as any,
        total: count || 0,
      },
    }
  } catch (error: any) {
    console.error("Error searching negotiations:", error)
    return {
      success: false,
      error: error.message || "Failed to search negotiations",
    }
  }
}

/**
 * Update negotiation status (admin only)
 */
export async function updateNegotiationStatus(
  data: UpdateNegotiationStatusInput
): Promise<ActionResult<Negotiation>> {
  try {
    const adminId = await requireAdminAccess()

    const validationResult = updateNegotiationStatusSchema.safeParse(data)
    if (!validationResult.success) {
      return {
        success: false,
        error: "Validation failed",
        errors: validationResult.error.flatten().fieldErrors,
      }
    }

    const supabase = await createServerSupabaseClient()

    // Get negotiation details
    const { data: negotiationData, error: fetchError } = await supabase
      .from("negotiations")
      .select("*, product:products(id, status)")
      .eq("id", validationResult.data.id)
      .single()

    if (fetchError || !negotiationData) {
      return {
        success: false,
        error: "Negotiation not found",
      }
    }

    const negotiation = negotiationData as any

    // Update negotiation
    const updateData: any = {
      status: validationResult.data.status,
      admin_id: adminId, // Use admin_id instead of seller_id
      seller_id: adminId, // Keep for backward compatibility
      updated_at: new Date().toISOString(),
    }

    // Add final_price if provided (when approving)
    if (validationResult.data.final_price) {
      updateData.final_price = validationResult.data.final_price
    }

    // Add note if provided
    if (validationResult.data.note) {
      updateData.note = validationResult.data.note
    }

    // Keep admin_note for backward compatibility
    if (validationResult.data.admin_note) {
      updateData.admin_note = validationResult.data.admin_note
    }

    const { data: updatedNegotiation, error } = await supabase
      .from("negotiations")
      .update(updateData)
      .eq("id", validationResult.data.id)
      .select()
      .single()

    if (error) {
      console.error("Database error:", error)
      return {
        success: false,
        error: `Failed to update negotiation: ${error.message}`,
      }
    }

    // If approved, update product status to sold and create an order
    if (validationResult.data.status === "approved") {
      const { error: productError } = await supabase
        .from("products")
        .update({
          status: "sold",
          updated_at: new Date().toISOString(),
        })
        .eq("id", negotiation.product_id)

      if (productError) {
        console.error("Error updating product status:", productError)
      }

      // Auto-create order for approved negotiation
      try {
        const finalPrice = validationResult.data.final_price || negotiation.offer_price
        
        const { error: orderError } = await supabase
          .from("orders")
          .insert({
            product_id: negotiation.product_id,
            buyer_id: negotiation.buyer_id,
            seller_id: adminId,
            negotiation_id: negotiation.id,
            final_price: finalPrice,
            payment_method: "manual_transfer", // Default to manual transfer
            payment_status: "pending",
            order_status: "pending",
            admin_note: validationResult.data.note || validationResult.data.admin_note || "Order created from approved negotiation",
          })

        if (orderError) {
          console.error("Error creating order:", orderError)
          // Don't fail the negotiation update if order creation fails
          // Admin can manually create order later
        } else {
          revalidatePath("/orders")
        }
      } catch (orderCreationError: any) {
        console.error("Exception creating order:", orderCreationError)
      }
    }

    revalidatePath("/products")
    revalidatePath(`/products/${negotiation.product_id}`)
    revalidatePath("/negotiations")

    return {
      success: true,
      data: updatedNegotiation as any,
    }
  } catch (error: any) {
    console.error("Error updating negotiation:", error)
    return {
      success: false,
      error: error.message || "Failed to update negotiation",
    }
  }
}

/**
 * Create counter offer (admin only)
 */
export async function createCounterOffer(
  data: CounterOfferInput
): Promise<ActionResult<Negotiation>> {
  try {
    const adminId = await requireAdminAccess()

    const validationResult = counterOfferSchema.safeParse(data)
    if (!validationResult.success) {
      return {
        success: false,
        error: "Validation failed",
        errors: validationResult.error.flatten().fieldErrors,
      }
    }

    const supabase = await createServerSupabaseClient()

    // Update negotiation with counter offer
    const { data: negotiationData, error } = await supabase
      .from("negotiations")
      .update({
        status: "countered",
        counter_price: validationResult.data.counter_price,
        admin_note: validationResult.data.admin_note || null,
        seller_id: adminId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", validationResult.data.id)
      .select("*, product_id")
      .single()

    if (error) {
      console.error("Database error:", error)
      return {
        success: false,
        error: `Failed to create counter offer: ${error.message}`,
      }
    }

    const negotiation = negotiationData as any

    revalidatePath("/products")
    revalidatePath(`/products/${negotiation.product_id}`)

    return {
      success: true,
      data: negotiation as any,
    }
  } catch (error: any) {
    console.error("Error creating counter offer:", error)
    return {
      success: false,
      error: error.message || "Failed to create counter offer",
    }
  }
}

/**
 * Delete negotiation (admin only)
 */
export async function deleteNegotiation(
  id: string
): Promise<ActionResult<void>> {
  try {
    await requireAdminAccess()

    const supabase = await createServerSupabaseClient()

    // Get product_id before deleting
    const { data: negotiationData } = await supabase
      .from("negotiations")
      .select("product_id")
      .eq("id", id)
      .single()

    const negotiation = negotiationData as any

    const { error } = await supabase.from("negotiations").delete().eq("id", id)

    if (error) {
      console.error("Database error:", error)
      return {
        success: false,
        error: `Failed to delete negotiation: ${error.message}`,
      }
    }

    if (negotiation) {
      revalidatePath("/products")
      revalidatePath(`/products/${negotiation.product_id}`)
    }

    return {
      success: true,
    }
  } catch (error: any) {
    console.error("Error deleting negotiation:", error)
    return {
      success: false,
      error: error.message || "Failed to delete negotiation",
    }
  }
}
