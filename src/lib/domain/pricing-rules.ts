/**
 * Pricing Rules & Guardrail System
 * Defines pricing rules based on category and price range
 * This is the single source of truth for all pricing logic
 */

export interface PricingRule {
  categoryName: string
  minBasePrice: number
  maxBasePrice: number | null // null means no upper limit
  minMarkup: number // Minimum markup to add to base_price
  maxNegoSteps: number // Maximum negotiation attempts
}

/**
 * Centralized Pricing Rules
 * These rules control all pricing calculations in the system
 */
export const PRICING_RULES: PricingRule[] = [
  // Smartphone rules
  {
    categoryName: 'Smartphone',
    minBasePrice: 0,
    maxBasePrice: 1_000_000,
    minMarkup: 100_000,
    maxNegoSteps: 1,
  },
  {
    categoryName: 'Smartphone',
    minBasePrice: 1_000_000,
    maxBasePrice: 3_000_000,
    minMarkup: 200_000,
    maxNegoSteps: 2,
  },
  {
    categoryName: 'Smartphone',
    minBasePrice: 3_000_000,
    maxBasePrice: null,
    minMarkup: 300_000,
    maxNegoSteps: 1,
  },
  // Laptop rules
  {
    categoryName: 'Laptop',
    minBasePrice: 0,
    maxBasePrice: 3_000_000,
    minMarkup: 200_000,
    maxNegoSteps: 1,
  },
  {
    categoryName: 'Laptop',
    minBasePrice: 3_000_000,
    maxBasePrice: null,
    minMarkup: 300_000,
    maxNegoSteps: 2,
  },
  // Default rule for other categories
  {
    categoryName: 'default',
    minBasePrice: 0,
    maxBasePrice: null,
    minMarkup: 150_000,
    maxNegoSteps: 1,
  },
]

/**
 * Find applicable pricing rule for a given category and base price
 */
export function findPricingRule(
  categoryName: string,
  basePrice: number
): PricingRule {
  // Find matching rule for the category
  const categoryRules = PRICING_RULES.filter(
    (rule) => rule.categoryName.toLowerCase() === categoryName.toLowerCase()
  )

  // Find rule that matches the price range
  for (const rule of categoryRules) {
    if (basePrice >= rule.minBasePrice) {
      if (rule.maxBasePrice === null || basePrice <= rule.maxBasePrice) {
        return rule
      }
    }
  }

  // Fallback to default rule
  const defaultRule = PRICING_RULES.find((rule) => rule.categoryName === 'default')
  if (!defaultRule) {
    throw new Error('Default pricing rule not found')
  }

  return defaultRule
}

/**
 * Calculate selling price based on pricing rule
 */
export function calculateSellingPrice(
  categoryName: string,
  basePrice: number
): number {
  const rule = findPricingRule(categoryName, basePrice)
  return basePrice + rule.minMarkup
}

/**
 * Calculate minimum negotiation price
 * This is the floor price - user cannot offer below this
 */
export function calculateMinNegoPrice(
  categoryName: string,
  basePrice: number
): number {
  // Min nego price is base price + small buffer (e.g., 50% of markup)
  const rule = findPricingRule(categoryName, basePrice)
  const buffer = Math.floor(rule.minMarkup * 0.5)
  return basePrice + buffer
}

/**
 * Calculate maximum negotiation price
 * This is the ceiling price - user cannot offer above this
 */
export function calculateMaxNegoPrice(
  categoryName: string,
  basePrice: number
): number {
  // Max nego price is the selling price
  return calculateSellingPrice(categoryName, basePrice)
}

/**
 * Get maximum negotiation steps allowed
 */
export function getMaxNegoSteps(
  categoryName: string,
  basePrice: number
): number {
  const rule = findPricingRule(categoryName, basePrice)
  return rule.maxNegoSteps
}

/**
 * Calculate system counter offer
 * System generates counter based on current attempt and pricing floor
 */
export function calculateCounterOffer(
  categoryName: string,
  basePrice: number,
  userOffer: number,
  attemptNumber: number
): number {
  const rule = findPricingRule(categoryName, basePrice)
  const sellingPrice = calculateSellingPrice(categoryName, basePrice)
  const minPrice = calculateMinNegoPrice(categoryName, basePrice)

  // Calculate counter as percentage between min and selling price
  // First attempt: closer to selling price
  // Later attempts: move toward min price
  const range = sellingPrice - minPrice
  const stepPercentage = 1 - attemptNumber / (rule.maxNegoSteps + 1)
  const counter = Math.floor(minPrice + range * stepPercentage)

  // Ensure counter is above minimum and below selling price
  return Math.max(minPrice, Math.min(counter, sellingPrice))
}

/**
 * Validate if an offer price is within acceptable range
 */
export function validateOfferPrice(
  categoryName: string,
  basePrice: number,
  offerPrice: number
): { valid: boolean; reason?: string } {
  const minPrice = calculateMinNegoPrice(categoryName, basePrice)
  const maxPrice = calculateMaxNegoPrice(categoryName, basePrice)

  if (offerPrice < minPrice) {
    return {
      valid: false,
      reason: `Offer price too low. Minimum acceptable price is ${minPrice.toLocaleString('id-ID')}`,
    }
  }

  if (offerPrice > maxPrice) {
    return {
      valid: false,
      reason: `Offer price too high. Maximum price is ${maxPrice.toLocaleString('id-ID')}`,
    }
  }

  return { valid: true }
}

/**
 * Validate negotiation attempt count
 */
export function validateNegoAttempt(
  categoryName: string,
  basePrice: number,
  currentAttempts: number
): { valid: boolean; reason?: string } {
  const maxSteps = getMaxNegoSteps(categoryName, basePrice)

  if (currentAttempts >= maxSteps) {
    return {
      valid: false,
      reason: `Maximum negotiation attempts (${maxSteps}) reached`,
    }
  }

  return { valid: true }
}

/**
 * Get pricing breakdown for display
 */
export interface PricingBreakdown {
  basePrice: number
  sellingPrice: number
  minNegoPrice: number
  maxNegoPrice: number
  markup: number
  maxNegoSteps: number
  rule: PricingRule
}

export function getPricingBreakdown(
  categoryName: string,
  basePrice: number
): PricingBreakdown {
  const rule = findPricingRule(categoryName, basePrice)
  const sellingPrice = calculateSellingPrice(categoryName, basePrice)
  const minNegoPrice = calculateMinNegoPrice(categoryName, basePrice)
  const maxNegoPrice = calculateMaxNegoPrice(categoryName, basePrice)

  return {
    basePrice,
    sellingPrice,
    minNegoPrice,
    maxNegoPrice,
    markup: sellingPrice - basePrice,
    maxNegoSteps: rule.maxNegoSteps,
    rule,
  }
}
