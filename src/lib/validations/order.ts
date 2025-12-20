import { z } from 'zod'

// Payment method enum
export const paymentMethods = ['cod', 'transfer'] as const
export type PaymentMethod = typeof paymentMethods[number]

// Payment status enum
export const paymentStatuses = ['pending', 'paid', 'failed'] as const
export type PaymentStatus = typeof paymentStatuses[number]

// Order status enum - Sprint 2
export const orderStatuses = ['pending', 'waiting_payment', 'waiting_meetup', 'paid', 'completed', 'cancelled', 'rejected'] as const
export type OrderStatus = typeof orderStatuses[number]

// Delivery type enum
export const deliveryTypes = ['meetup', 'pickup'] as const
export type DeliveryType = typeof deliveryTypes[number]

// Base order schema
export const orderSchema = z.object({
  id: z.string().uuid(),
  product_id: z.string().uuid(),
  buyer_id: z.string().uuid(),
  seller_id: z.string().uuid().nullable(),
  negotiation_id: z.string().uuid().nullable(),
  final_price: z.number().int().positive(),
  payment_method: z.enum(paymentMethods),
  payment_status: z.enum(paymentStatuses),
  order_status: z.enum(orderStatuses),
  payment_reference: z.string().nullable(),
  delivery_type: z.enum(deliveryTypes).nullable(),
  cancel_reason: z.string().nullable(),
  meetup_at: z.string().datetime().nullable(),
  meetup_location: z.string().nullable(),
  admin_note: z.string().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
})

// Order type
export type Order = z.infer<typeof orderSchema>

// Create order input
export const createOrderSchema = z.object({
  product_id: z.string().uuid({ message: 'Product ID is required' }),
  buyer_id: z.string().uuid({ message: 'Buyer ID is required' }),
  negotiation_id: z.string().uuid().optional().nullable(),
  final_price: z.number().int().positive({ message: 'Final price must be greater than 0' }),
  payment_method: z.enum(paymentMethods).default('cod'),
  payment_status: z.enum(paymentStatuses).default('pending'),
  order_status: z.enum(orderStatuses).default('pending'),
  shipping_address: z.string().min(10, { message: 'Shipping address must be at least 10 characters' }),
  admin_note: z.string().optional(),
})

export type CreateOrderInput = z.infer<typeof createOrderSchema>

// Update order status input
export const updateOrderStatusSchema = z.object({
  id: z.string().uuid({ message: 'Order ID is required' }),
  order_status: z.enum(orderStatuses, { message: 'Invalid order status' }),
  admin_note: z.string().optional(),
})

export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>

// Update payment status input
export const updatePaymentStatusSchema = z.object({
  id: z.string().uuid({ message: 'Order ID is required' }),
  payment_status: z.enum(paymentStatuses, { message: 'Invalid payment status' }),
  admin_note: z.string().optional(),
})

export type UpdatePaymentStatusInput = z.infer<typeof updatePaymentStatusSchema>

// Order with product, buyer, and negotiation details
export type OrderWithDetails = Order & {
  product?: {
    id: string
    name: string
    main_image_url: string | null
    base_price: number
    selling_price: number
    condition: string
  }
  buyer?: {
    id: string
    email: string
    full_name: string | null
  }
  negotiation?: {
    id: string
    offer_price: number
    counter_price: number | null
    status: string
    admin_note: string | null
  }
}

// Search/filter orders
export const orderSearchSchema = z.object({
  product_id: z.string().uuid().optional(),
  buyer_id: z.string().uuid().optional(),
  payment_status: z.enum(paymentStatuses).optional(),
  order_status: z.enum(orderStatuses).optional(),
  payment_method: z.enum(paymentMethods).optional(),
  search: z.string().optional(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
  sort_by: z.enum(['created_at', 'final_price', 'order_status', 'payment_status']).default('created_at'),
  sort_order: z.enum(['asc', 'desc']).default('desc'),
})

export type OrderSearch = z.infer<typeof orderSearchSchema>

// Cancel order schema
export const cancelOrderSchema = z.object({
  cancel_reason: z.string().min(10, { message: 'Cancel reason must be at least 10 characters' }),
  admin_note: z.string().optional(),
})

export type CancelOrderInput = z.infer<typeof cancelOrderSchema>

// Approve/Reject order schema
export const approveOrderSchema = z.object({
  admin_note: z.string().optional(),
})

export const rejectOrderSchema = z.object({
  reject_reason: z.string().min(10, { message: 'Reject reason must be at least 10 characters' }),
  admin_note: z.string().optional(),
})

export type ApproveOrderInput = z.infer<typeof approveOrderSchema>
export type RejectOrderInput = z.infer<typeof rejectOrderSchema>

// Mark paid schema (for transfer verification)
export const markPaidSchema = z.object({
  payment_reference: z.string().optional(),
  admin_note: z.string().optional(),
})

export type MarkPaidInput = z.infer<typeof markPaidSchema>

// Complete order schema
export const completeOrderSchema = z.object({
  admin_note: z.string().optional(),
})

export type CompleteOrderInput = z.infer<typeof completeOrderSchema>
