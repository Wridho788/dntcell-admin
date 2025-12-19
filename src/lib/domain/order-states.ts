/**
 * Order State Machine
 * Admin panel is the single source of truth for order management
 * User app only submits intent, admin controls all state transitions
 */

export enum OrderStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum PaymentStatus {
  PENDING = 'pending',
  PAID = 'paid',
  FAILED = 'failed',
}

export enum PaymentMethod {
  COD = 'cod',
  TRANSFER = 'transfer',
}

export type UserRole = 'user' | 'admin'

/**
 * Order state for validation
 */
export interface OrderState {
  order_status: OrderStatus
  payment_status: PaymentStatus
  payment_method: PaymentMethod
}

/**
 * Validation context
 */
export interface TransitionContext {
  currentOrder: OrderState
  nextOrderStatus?: OrderStatus
  nextPaymentStatus?: PaymentStatus
  actor: UserRole
  action: string
}

/**
 * Valid state transitions mapping
 * Each key represents an action, mapped to validation rules
 */
const TRANSITION_RULES: Record<string, (ctx: TransitionContext) => boolean> = {
  // CREATE ORDER - Initial state (user submits order)
  'create_order': (ctx) => {
    const { currentOrder } = ctx
    return (
      currentOrder.order_status === OrderStatus.PENDING &&
      currentOrder.payment_status === PaymentStatus.PENDING
    )
  },

  // CONFIRM ORDER - Admin confirms order is valid
  'confirm_order': (ctx) => {
    const { currentOrder, nextOrderStatus, actor } = ctx
    return (
      actor === 'admin' &&
      currentOrder.order_status === OrderStatus.PENDING &&
      nextOrderStatus === OrderStatus.CONFIRMED
    )
  },

  // MARK AS PAID - Admin marks payment as received (transfer only)
  'mark_as_paid': (ctx) => {
    const { currentOrder, nextPaymentStatus, actor } = ctx
    return (
      actor === 'admin' &&
      currentOrder.payment_method === PaymentMethod.TRANSFER &&
      currentOrder.payment_status === PaymentStatus.PENDING &&
      nextPaymentStatus === PaymentStatus.PAID
    )
  },

  // PROCESS ORDER - Admin starts processing
  'process_order': (ctx) => {
    const { currentOrder, nextOrderStatus, actor } = ctx
    return (
      actor === 'admin' &&
      currentOrder.order_status === OrderStatus.CONFIRMED &&
      nextOrderStatus === OrderStatus.PROCESSING
    )
  },

  // COMPLETE ORDER - Admin marks order as completed
  'complete_order': (ctx) => {
    const { currentOrder, nextOrderStatus, actor } = ctx
    return (
      actor === 'admin' &&
      currentOrder.order_status === OrderStatus.PROCESSING &&
      nextOrderStatus === OrderStatus.COMPLETED
    )
  },

  // CANCEL ORDER - Admin cancels order (except completed)
  'cancel_order': (ctx) => {
    const { currentOrder, nextOrderStatus, actor } = ctx
    return (
      actor === 'admin' &&
      currentOrder.order_status !== OrderStatus.COMPLETED &&
      nextOrderStatus === OrderStatus.CANCELLED
    )
  },
}

/**
 * Assert that an order transition is valid
 * Throws error if transition is invalid
 * 
 * @param context Transition context with current state and desired next state
 * @throws Error with status 409 if transition is invalid
 */
export function assertOrderTransition(context: TransitionContext): void {
  const { action, actor } = context
  
  // Check if action is defined
  const validator = TRANSITION_RULES[action]
  if (!validator) {
    throw {
      message: `Unknown action: ${action}`,
      status: 400,
    }
  }

  // Validate transition
  const isValid = validator(context)
  
  if (!isValid) {
    throw {
      message: `Invalid state transition: Cannot perform '${action}' on order with status '${context.currentOrder.order_status}' and payment status '${context.currentOrder.payment_status}' as ${actor}`,
      status: 409,
      details: {
        current_order_status: context.currentOrder.order_status,
        current_payment_status: context.currentOrder.payment_status,
        next_order_status: context.nextOrderStatus,
        next_payment_status: context.nextPaymentStatus,
        actor,
        action,
      },
    }
  }
}

/**
 * Get initial order state based on payment method
 * All orders start as pending regardless of payment method
 */
export function getInitialOrderState(paymentMethod: PaymentMethod): OrderState {
  return {
    order_status: OrderStatus.PENDING,
    payment_status: PaymentStatus.PENDING,
    payment_method: paymentMethod,
  }
}

/**
 * Check if order can be cancelled by admin
 */
export function canCancelOrder(order: OrderState): boolean {
  // Cannot cancel completed orders
  return order.order_status !== OrderStatus.COMPLETED
}

/**
 * Check if payment can be marked as paid
 */
export function canMarkAsPaid(order: OrderState): boolean {
  return (
    order.payment_method === PaymentMethod.TRANSFER &&
    order.payment_status === PaymentStatus.PENDING
  )
}
