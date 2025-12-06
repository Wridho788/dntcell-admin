import { z } from 'zod'

// Negotiation status enum - updated to use 'approved' instead of 'accepted'
export const negotiationStatuses = ['pending', 'approved', 'rejected', 'countered'] as const
export type NegotiationStatus = typeof negotiationStatuses[number]

// Base negotiation schema
export const negotiationSchema = z.object({
  id: z.string().uuid(),
  product_id: z.string().uuid(),
  buyer_id: z.string().uuid(),
  seller_id: z.string().uuid().nullable(), // Kept for backward compatibility
  admin_id: z.string().uuid().nullable(), // Admin who approved/rejected
  offer_price: z.number().int().positive(),
  final_price: z.number().int().positive().nullable(), // Final price when approved
  status: z.enum(negotiationStatuses),
  counter_price: z.number().int().positive().nullable(),
  admin_note: z.string().nullable(), // Kept for backward compatibility
  note: z.string().nullable(), // New field for rejection notes
  used: z.boolean().default(false), // Whether negotiation has been used in an order
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
})

// Negotiation type
export type Negotiation = z.infer<typeof negotiationSchema>

// Create negotiation input
export const createNegotiationSchema = z.object({
  product_id: z.string().uuid({ message: 'Product ID is required' }),
  offer_price: z.number().int().positive({ message: 'Offer price must be greater than 0' }),
  buyer_id: z.string().uuid().optional(), // Will be set from auth in server action
})

export type CreateNegotiationInput = z.infer<typeof createNegotiationSchema>

// Update negotiation status input (approve/reject)
export const updateNegotiationStatusSchema = z.object({
  id: z.string().uuid({ message: 'Negotiation ID is required' }),
  status: z.enum(negotiationStatuses, { message: 'Invalid status' }),
  final_price: z.number().int().positive().optional(), // Required when approving
  note: z.string().optional(), // Rejection note or admin comments
  admin_note: z.string().optional(), // Kept for backward compatibility
})

export type UpdateNegotiationStatusInput = z.infer<typeof updateNegotiationStatusSchema>

// Counter offer input
export const counterOfferSchema = z.object({
  id: z.string().uuid({ message: 'Negotiation ID is required' }),
  counter_price: z.number().int().positive({ message: 'Counter price must be greater than 0' }),
  admin_note: z.string().optional(),
})

export type CounterOfferInput = z.infer<typeof counterOfferSchema>

// Negotiation with product and buyer details
export type NegotiationWithDetails = Negotiation & {
  product?: {
    id: string
    name: string
    main_image_url: string | null
    base_price: number
    selling_price: number
  }
  buyer?: {
    id: string
    email: string
    full_name: string | null
  }
}

// Search/filter negotiations
export const negotiationSearchSchema = z.object({
  product_id: z.string().uuid().optional(),
  buyer_id: z.string().uuid().optional(),
  status: z.enum(negotiationStatuses).optional(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
  sort_by: z.enum(['created_at', 'offer_price', 'status']).default('created_at'),
  sort_order: z.enum(['asc', 'desc']).default('desc'),
})

export type NegotiationSearch = z.infer<typeof negotiationSearchSchema>
