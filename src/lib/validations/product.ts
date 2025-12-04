import { z } from 'zod'

// Product status enum - includes workflow states
export const ProductStatus = z.enum([
  'available',          // Initial state - being created
  'unavailable', // Submitted for review
  'sold'        // Archived/deleted
])
export type ProductStatus = z.infer<typeof ProductStatus>

// Product category validation
export const productCategorySchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, 'Category name is required').max(100, 'Category name too long'),
  description: z.string().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
})

// Product image validation
export const productImageSchema = z.object({
  id: z.string().uuid().optional(),
  product_id: z.string().uuid().optional(),
  url: z.string().url('Invalid image URL'),
  alt_text: z.string().optional(),
  is_primary: z.boolean().default(false),
  sort_order: z.number().default(0),
  created_at: z.string().optional(),
})

// Product condition enum
export const ProductCondition = z.enum(['new', 'like_new', 'good', 'fair', 'poor'])
export type ProductCondition = z.infer<typeof ProductCondition>

// Core product schema matching database structure
export const productSchema = z.object({
  id: z.string().uuid().optional(),
  seller_id: z.string().uuid('Invalid seller ID'),
  category_id: z.string().uuid('Invalid category ID').optional().nullable(),
  name: z
    .string()
    .min(1, 'Product name is required')
    .max(200, 'Product name too long'),
  description: z
    .string()
    .min(10, 'Description must be at least 10 characters')
    .max(5000, 'Description too long'),
  base_price: z
    .number()
    .positive('Base price must be positive')
    .max(999999999, 'Base price too high')
    .or(z.string().transform((val) => {
      const num = parseFloat(val)
      if (isNaN(num)) throw new Error('Invalid base price')
      return num
    })),
  selling_price: z
    .number()
    .positive('Selling price must be positive')
    .max(999999999, 'Selling price too high')
    .or(z.string().transform((val) => {
      const num = parseFloat(val)
      if (isNaN(num)) throw new Error('Invalid selling price')
      return num
    })),
  negotiable: z.boolean().default(false),
  stock: z
    .number()
    .int('Stock must be a whole number')
    .min(0, 'Stock cannot be negative')
    .optional()
    .or(z.string().transform((val) => {
      if (!val) return undefined
      const num = parseInt(val)
      if (isNaN(num)) throw new Error('Invalid stock quantity')
      return num
    }).optional()),
  condition: ProductCondition.default('new'),
  status: ProductStatus.default('available'),
  is_active: z.boolean().default(true),
  details: z.any().optional(),
  reject_note: z.string().optional().nullable(),
  main_image_url: z.string().url().optional().nullable(),
  images: z.array(productImageSchema).optional().default([]),
  created_at: z.string().optional(),
})

// Form schemas (for client-side validation)
export const createProductSchema = productSchema
  .omit({
    id: true,
    seller_id: true, // Will be set automatically on server
    created_at: true,
  })
  .refine(
    (data) => {
      // Selling price must be at least 100,000 more than base price
      if (data.selling_price < data.base_price + 100000) {
        return false
      }
      return true
    },
    {
      message: "Selling price must be at least 100,000 more than base price",
      path: ["selling_price"]
    }
  )

export const updateProductSchema = productSchema.partial().extend({
  id: z.string().uuid('Invalid product ID'),
}).refine(
  (data) => {
    // If both base_price and selling_price are provided, validate the difference
    if (data.base_price !== undefined && data.selling_price !== undefined) {
      if (data.selling_price < data.base_price + 100000) {
        return false
      }
    }
    return true
  },
  {
    message: "Selling price must be at least 100,000 more than base price",
    path: ["selling_price"]
  }
)

// Search and filter schemas
export const productSearchSchema = z.object({
  query: z.string().optional(),
  category_id: z.string().uuid().optional(),
  seller_id: z.string().uuid().optional(),
  condition: ProductCondition.optional(),
  status: ProductStatus.optional(),
  is_active: z.boolean().optional(),
  negotiable: z.boolean().optional(),
  min_price: z.number().positive().optional(),
  max_price: z.number().positive().optional(),
  sort_by: z.enum(['name', 'base_price', 'selling_price', 'created_at']).default('created_at'),
  sort_order: z.enum(['asc', 'desc']).default('desc'),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
})

// Image upload schema
export const imageUploadSchema = z.object({
  file: z.instanceof(File, { message: 'Please select a valid image file' }),
  alt_text: z.string().optional(),
  is_primary: z.boolean().default(false),
})

// Bulk operations schema
export const bulkProductActionSchema = z.object({
  action: z.enum(['delete', 'activate', 'deactivate', 'archive']),
  product_ids: z.array(z.string().uuid()).min(1, 'At least one product must be selected'),
})

// Export types
export type Product = z.infer<typeof productSchema>
export type CreateProductInput = z.infer<typeof createProductSchema>
export type UpdateProductInput = z.infer<typeof updateProductSchema>
export type ProductSearch = z.infer<typeof productSearchSchema>
export type ProductImage = z.infer<typeof productImageSchema>
export type ProductCategory = z.infer<typeof productCategorySchema>
export type ImageUpload = z.infer<typeof imageUploadSchema>
export type BulkProductAction = z.infer<typeof bulkProductActionSchema>

// Validation helpers
export const validateProduct = (data: unknown) => {
  return productSchema.safeParse(data)
}

export const validateCreateProduct = (data: unknown) => {
  return createProductSchema.safeParse(data)
}

export const validateUpdateProduct = (data: unknown) => {
  return updateProductSchema.safeParse(data)
}

export const validateProductSearch = (data: unknown) => {
  return productSearchSchema.safeParse(data)
}