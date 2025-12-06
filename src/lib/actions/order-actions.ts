"use server"

import { revalidatePath } from "next/cache"
import {
  createServerSupabaseClient,
  getCurrentUser,
  isUserAdmin,
} from "@/lib/supabase/server"
import {
  createOrderSchema,
  updateOrderStatusSchema,
  updatePaymentStatusSchema,
  orderSearchSchema,
  type Order,
  type CreateOrderInput,
  type UpdateOrderStatusInput,
  type UpdatePaymentStatusInput,
  type OrderSearch,
  type OrderWithDetails,
} from "@/lib/validations/order"

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
 * Create a new order (admin only)
 */
export async function createOrder(
  data: CreateOrderInput
): Promise<ActionResult<Order>> {
  try {
    const adminId = await requireAdminAccess()

    // Validate input
    const validationResult = createOrderSchema.safeParse(data)
    if (!validationResult.success) {
      return {
        success: false,
        error: "Validation failed",
        errors: validationResult.error.flatten().fieldErrors,
      }
    }

    const supabase = await createServerSupabaseClient()

    // Check if product exists
    const { data: products, error: productError } = await supabase
      .from("products")
      .select("id, name")
      .eq("id", validationResult.data.product_id)

    if (productError || !products || products.length === 0) {
      return {
        success: false,
        error: "Product not found",
      }
    }

    // Check if buyer exists
    const { data: buyers, error: buyerError } = await supabase
      .from("users")
      .select("id")
      .eq("id", validationResult.data.buyer_id)

    if (buyerError || !buyers || buyers.length === 0) {
      return {
        success: false,
        error: "Buyer not found",
      }
    }

    // If order is from negotiation, validate and mark as used
    if (validationResult.data.negotiation_id) {
      const { data: negotiation, error: negError } = await supabase
        .from("negotiations")
        .select("id, status, used, final_price")
        .eq("id", validationResult.data.negotiation_id)
        .single()

      if (negError || !negotiation) {
        return {
          success: false,
          error: "Negotiation not found",
        }
      }

      const neg = negotiation as any

      if (neg.status !== 'approved') {
        return {
          success: false,
          error: "Negotiation must be approved before creating order",
        }
      }

      if (neg.used) {
        return {
          success: false,
          error: "Negotiation has already been used for another order",
        }
      }

      // Ensure price matches negotiation final_price
      if (validationResult.data.final_price !== neg.final_price) {
        return {
          success: false,
          error: "Order price must match negotiation final price",
        }
      }

      // Mark negotiation as used
      const { error: updateError } = await supabase
        .from("negotiations")
        .update({ used: true, updated_at: new Date().toISOString() })
        .eq("id", validationResult.data.negotiation_id)

      if (updateError) {
        console.error("Failed to mark negotiation as used:", updateError)
        return {
          success: false,
          error: "Failed to update negotiation status",
        }
      }
    }

    // Create order
    const { data: order, error } = await supabase
      .from("orders")
      .insert({
        product_id: validationResult.data.product_id,
        buyer_id: validationResult.data.buyer_id,
        seller_id: adminId,
        negotiation_id: validationResult.data.negotiation_id || null,
        final_price: validationResult.data.final_price,
        payment_method: validationResult.data.payment_method,
        payment_status: validationResult.data.payment_status,
        order_status: validationResult.data.order_status,
        shipping_address: validationResult.data.shipping_address,
        admin_note: validationResult.data.admin_note || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) {
      console.error("Database error:", error)
      return {
        success: false,
        error: `Failed to create order: ${error.message}`,
      }
    }

    revalidatePath("/orders")
    revalidatePath(`/products/${validationResult.data.product_id}`)

    return {
      success: true,
      data: order as any,
    }
  } catch (error: any) {
    console.error("Error creating order:", error)
    return {
      success: false,
      error: error.message || "Failed to create order",
    }
  }
}

/**
 * Get all orders with filters (admin only)
 */
export async function searchOrders(
  params: OrderSearch
): Promise<ActionResult<{ orders: OrderWithDetails[]; total: number }>> {
  try {
    await requireAdminAccess()

    const validationResult = orderSearchSchema.safeParse(params)
    if (!validationResult.success) {
      return {
        success: false,
        error: "Invalid search parameters",
        errors: validationResult.error.flatten().fieldErrors,
      }
    }

    const {
      page,
      limit,
      sort_by,
      sort_order,
      product_id,
      buyer_id,
      payment_status,
      order_status,
      payment_method,
    } = validationResult.data

    const supabase = await createServerSupabaseClient()

    // Build query
    let query = supabase
      .from("orders")
      .select(
        `
        *,
        product:products(id, name, main_image_url, base_price, selling_price, condition),
        buyer:users!orders_buyer_id_fkey(id, email, full_name),
        negotiation:negotiations(id, offer_price, status)
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
    if (payment_status) {
      query = query.eq("payment_status", payment_status)
    }
    if (order_status) {
      query = query.eq("order_status", order_status)
    }
    if (payment_method) {
      query = query.eq("payment_method", payment_method)
    }

    // Apply sorting
    query = query.order(sort_by, { ascending: sort_order === "asc" })

    // Apply pagination
    const from = (page - 1) * limit
    const to = from + limit - 1
    query = query.range(from, to)

    const { data: orders, error, count } = await query

    if (error) {
      console.error("Database error:", error)
      return {
        success: false,
        error: `Failed to search orders: ${error.message}`,
      }
    }

    return {
      success: true,
      data: {
        orders: orders as any,
        total: count || 0,
      },
    }
  } catch (error: any) {
    console.error("Error searching orders:", error)
    return {
      success: false,
      error: error.message || "Failed to search orders",
    }
  }
}

/**
 * Get order by ID (admin only)
 */
export async function getOrderById(
  id: string
): Promise<ActionResult<OrderWithDetails>> {
  try {
    await requireAdminAccess()

    const supabase = await createServerSupabaseClient()

    const { data: order, error } = await supabase
      .from("orders")
      .select(
        `
        *,
        product:products(id, name, main_image_url, base_price, selling_price, condition),
        buyer:users!orders_buyer_id_fkey(id, email, full_name),
        negotiation:negotiations(id, offer_price, status)
      `
      )
      .eq("id", id)
      .single()

    if (error) {
      console.error("Database error:", error)
      return {
        success: false,
        error: `Failed to fetch order: ${error.message}`,
      }
    }

    if (!order) {
      return {
        success: false,
        error: "Order not found",
      }
    }

    return {
      success: true,
      data: order as any,
    }
  } catch (error: any) {
    console.error("Error fetching order:", error)
    return {
      success: false,
      error: error.message || "Failed to fetch order",
    }
  }
}

/**
 * Update order status (admin only)
 */
export async function updateOrderStatus(
  data: UpdateOrderStatusInput
): Promise<ActionResult<Order>> {
  try {
    await requireAdminAccess()

    const validationResult = updateOrderStatusSchema.safeParse(data)
    if (!validationResult.success) {
      return {
        success: false,
        error: "Validation failed",
        errors: validationResult.error.flatten().fieldErrors,
      }
    }

    const supabase = await createServerSupabaseClient()

    // Update order
    const updateData: any = {
      order_status: validationResult.data.order_status,
      updated_at: new Date().toISOString(),
    }

    if (validationResult.data.admin_note) {
      updateData.admin_note = validationResult.data.admin_note
    }

    const { data: orderData, error } = await supabase
      .from("orders")
      .update(updateData)
      .eq("id", validationResult.data.id)
      .select()
      .single()

    if (error) {
      console.error("Database error:", error)
      return {
        success: false,
        error: `Failed to update order status: ${error.message}`,
      }
    }

    const order = orderData as any

    revalidatePath("/orders")
    revalidatePath(`/orders/${validationResult.data.id}`)
    if (order.product_id) {
      revalidatePath(`/products/${order.product_id}`)
    }

    return {
      success: true,
      data: order,
    }
  } catch (error: any) {
    console.error("Error updating order status:", error)
    return {
      success: false,
      error: error.message || "Failed to update order status",
    }
  }
}

/**
 * Update payment status (admin only)
 */
export async function updatePaymentStatus(
  data: UpdatePaymentStatusInput
): Promise<ActionResult<Order>> {
  try {
    await requireAdminAccess()

    const validationResult = updatePaymentStatusSchema.safeParse(data)
    if (!validationResult.success) {
      return {
        success: false,
        error: "Validation failed",
        errors: validationResult.error.flatten().fieldErrors,
      }
    }

    const supabase = await createServerSupabaseClient()

    // Update payment
    const updateData: any = {
      payment_status: validationResult.data.payment_status,
      updated_at: new Date().toISOString(),
    }

    if (validationResult.data.admin_note) {
      updateData.admin_note = validationResult.data.admin_note
    }

    const { data: orderData, error } = await supabase
      .from("orders")
      .update(updateData)
      .eq("id", validationResult.data.id)
      .select()
      .single()

    if (error) {
      console.error("Database error:", error)
      return {
        success: false,
        error: `Failed to update payment status: ${error.message}`,
      }
    }

    const order = orderData as any

    revalidatePath("/orders")
    revalidatePath(`/orders/${validationResult.data.id}`)
    if (order.product_id) {
      revalidatePath(`/products/${order.product_id}`)
    }

    return {
      success: true,
      data: order,
    }
  } catch (error: any) {
    console.error("Error updating payment status:", error)
    return {
      success: false,
      error: error.message || "Failed to update payment status",
    }
  }
}

/**
 * Delete order (admin only)
 */
export async function deleteOrder(id: string): Promise<ActionResult<void>> {
  try {
    await requireAdminAccess()

    const supabase = await createServerSupabaseClient()

    // Get product_id before deleting
    const { data: orderData } = await supabase
      .from("orders")
      .select("product_id")
      .eq("id", id)
      .single()

    const order = orderData as any

    const { error } = await supabase.from("orders").delete().eq("id", id)

    if (error) {
      console.error("Database error:", error)
      return {
        success: false,
        error: `Failed to delete order: ${error.message}`,
      }
    }

    revalidatePath("/orders")
    if (order?.product_id) {
      revalidatePath(`/products/${order.product_id}`)
    }

    return {
      success: true,
    }
  } catch (error: any) {
    console.error("Error deleting order:", error)
    return {
      success: false,
      error: error.message || "Failed to delete order",
    }
  }
}
