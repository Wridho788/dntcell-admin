/**
 * Pricing Service
 * Centralized service for all pricing calculations
 * Ensures consistency across product and negotiation workflows
 */

import { supabaseAdmin } from '@/api/_core/supabase-server'
import {
  calculateSellingPrice,
  calculateMinNegoPrice,
  calculateMaxNegoPrice,
  getMaxNegoSteps,
  getPricingBreakdown,
  validateOfferPrice,
  validateNegoAttempt,
  calculateCounterOffer,
  type PricingBreakdown,
} from '@/lib/domain/pricing-rules'

export interface ProductPricing {
  basePrice: number
  sellingPrice: number
  minNegoPrice: number
  maxNegoPrice: number
}

/**
 * Calculate all pricing fields for a product
 * This is called during product creation and updates
 */
export async function calculateProductPricing(
  categoryId: string,
  basePrice: number
): Promise<ProductPricing> {
  // Get category name
  const { data: category } = await supabaseAdmin
    .from('categories')
    .select('name')
    .eq('id', categoryId)
    .single()

  const categoryName = category?.name || 'default'

  return {
    basePrice,
    sellingPrice: calculateSellingPrice(categoryName, basePrice),
    minNegoPrice: calculateMinNegoPrice(categoryName, basePrice),
    maxNegoPrice: calculateMaxNegoPrice(categoryName, basePrice),
  }
}

/**
 * Recalculate product pricing when base_price or category changes
 * Returns updated pricing fields
 */
export async function recalculateProductPricing(
  productId: string,
  newBasePrice?: number,
  newCategoryId?: string
): Promise<ProductPricing> {
  // Get current product data
  const { data: product } = await supabaseAdmin
    .from('products')
    .select('base_price, category_id')
    .eq('id', productId)
    .single()

  if (!product) {
    throw new Error('Product not found')
  }

  const basePrice = newBasePrice ?? product.base_price
  const categoryId = newCategoryId ?? product.category_id

  return calculateProductPricing(categoryId, basePrice)
}

/**
 * Get pricing breakdown for display in admin panel
 */
export async function getProductPricingBreakdown(
  categoryId: string,
  basePrice: number
): Promise<PricingBreakdown> {
  // Get category name
  const { data: category } = await supabaseAdmin
    .from('categories')
    .select('name')
    .eq('id', categoryId)
    .single()

  const categoryName = category?.name || 'default'

  return getPricingBreakdown(categoryName, basePrice)
}

/**
 * Validate negotiation offer from user
 */
export async function validateNegotiationOffer(
  productId: string,
  offerPrice: number
): Promise<{ valid: boolean; reason?: string }> {
  // Get product pricing data
  const { data: product } = await supabaseAdmin
    .from('products')
    .select('base_price, min_nego_price, max_nego_price, category:categories(name)')
    .eq('id', productId)
    .single()

  if (!product) {
    return { valid: false, reason: 'Product not found' }
  }

  const categoryName = (product.category as any)?.name || 'default'

  return validateOfferPrice(categoryName, product.base_price, offerPrice)
}

/**
 * Generate system counter offer
 */
export async function generateCounterOffer(
  productId: string,
  userOffer: number,
  attemptNumber: number
): Promise<number> {
  // Get product data
  const { data: product } = await supabaseAdmin
    .from('products')
    .select('base_price, category:categories(name)')
    .eq('id', productId)
    .single()

  if (!product) {
    throw new Error('Product not found')
  }

  const categoryName = (product.category as any)?.name || 'default'

  return calculateCounterOffer(
    categoryName,
    product.base_price,
    userOffer,
    attemptNumber
  )
}

/**
 * Validate negotiation attempt count
 */
export async function validateNegotiationAttempt(
  productId: string,
  currentAttempts: number
): Promise<{ valid: boolean; reason?: string }> {
  // Get product data
  const { data: product } = await supabaseAdmin
    .from('products')
    .select('base_price, category:categories(name)')
    .eq('id', productId)
    .single()

  if (!product) {
    return { valid: false, reason: 'Product not found' }
  }

  const categoryName = (product.category as any)?.name || 'default'

  return validateNegoAttempt(categoryName, product.base_price, currentAttempts)
}

/**
 * Get max negotiation steps for a product
 */
export async function getProductMaxNegoSteps(productId: string): Promise<number> {
  const { data: product } = await supabaseAdmin
    .from('products')
    .select('base_price, category:categories(name)')
    .eq('id', productId)
    .single()

  if (!product) {
    throw new Error('Product not found')
  }

  const categoryName = (product.category as any)?.name || 'default'

  return getMaxNegoSteps(categoryName, product.base_price)
}

/**
 * Create pricing snapshot for activity log
 */
export interface PricingSnapshot {
  basePrice: number
  sellingPrice: number
  minNegoPrice: number
  maxNegoPrice: number
  offerPrice?: number
  counterPrice?: number
  finalPrice?: number
  timestamp: string
}

export function createPricingSnapshot(
  basePrice: number,
  sellingPrice: number,
  minNegoPrice: number,
  maxNegoPrice: number,
  additionalData?: {
    offerPrice?: number
    counterPrice?: number
    finalPrice?: number
  }
): PricingSnapshot {
  return {
    basePrice,
    sellingPrice,
    minNegoPrice,
    maxNegoPrice,
    ...additionalData,
    timestamp: new Date().toISOString(),
  }
}
