/**
 * Order State Machine - Sprint 2
 * Admin panel is the single source of truth for order management
 * User app only submits intent, admin controls all state transitions
 */

export enum OrderStatus {
  PENDING = 'pending',
  WAITING_PAYMENT = 'waiting_payment',
  WAITING_MEETUP = 'waiting_meetup',
  PAID = 'paid',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  REJECTED = 'rejected',
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
 * Valid state transitions mapping - Sprint 2
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

  // APPROVE ORDER - Admin approves pending order
  'approve_order': (ctx) => {
    const { currentOrder, nextOrderStatus, actor } = ctx
    return (
      actor === 'admin' &&
      currentOrder.order_status === OrderStatus.PENDING &&
      (nextOrderStatus === OrderStatus.WAITING_PAYMENT || nextOrderStatus === OrderStatus.WAITING_MEETUP)
    )
  },

  // REJECT ORDER - Admin rejects pending order
  'reject_order': (ctx) => {
    const { currentOrder, nextOrderStatus, actor } = ctx
    return (
      actor === 'admin' &&
      currentOrder.order_status === OrderStatus.PENDING &&
      nextOrderStatus === OrderStatus.REJECTED
    )
  },

  // VERIFY PAYMENT - Admin verifies transfer payment
  'verify_payment': (ctx) => {
    const { currentOrder, nextPaymentStatus, actor } = ctx
    return (
      actor === 'admin' &&
      currentOrder.payment_method === PaymentMethod.TRANSFER &&
      currentOrder.order_status === OrderStatus.WAITING_PAYMENT &&
      currentOrder.payment_status === PaymentStatus.PENDING &&
      nextPaymentStatus === PaymentStatus.PAID
    )
  },

  // MARK AS PAID - Admin marks COD payment as paid after meetup
  'mark_as_paid': (ctx) => {
    const { currentOrder, nextOrderStatus, nextPaymentStatus, actor } = ctx
    return (
      actor === 'admin' &&
      currentOrder.payment_method === PaymentMethod.COD &&
      currentOrder.order_status === OrderStatus.WAITING_MEETUP &&
      nextOrderStatus === OrderStatus.PAID &&
      nextPaymentStatus === PaymentStatus.PAID
    )
  },

  // COMPLETE ORDER - Admin marks order as completed
  'complete_order': (ctx) => {
    const { currentOrder, nextOrderStatus, actor } = ctx
    return (
      actor === 'admin' &&
      currentOrder.order_status === OrderStatus.PAID &&
      currentOrder.payment_status === PaymentStatus.PAID &&
      nextOrderStatus === OrderStatus.COMPLETED
    )
  },

  // CANCEL ORDER - Admin cancels order (except completed and rejected)
  'cancel_order': (ctx) => {
    const { currentOrder, nextOrderStatus, actor } = ctx
    return (
      actor === 'admin' &&
      currentOrder.order_status !== OrderStatus.COMPLETED &&
      currentOrder.order_status !== OrderStatus.REJECTED &&
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
  // Cannot cancel completed or rejected orders
  return order.order_status !== OrderStatus.COMPLETED && order.order_status !== OrderStatus.REJECTED
}

/**
 * Check if payment can be verified (transfer)
 */
export function canVerifyPayment(order: OrderState): boolean {
  return (
    order.payment_method === PaymentMethod.TRANSFER &&
    order.order_status === OrderStatus.WAITING_PAYMENT &&
    order.payment_status === PaymentStatus.PENDING
  )
}

/**
 * Check if payment can be marked as paid (COD after meetup)
 */
export function canMarkAsPaid(order: OrderState): boolean {
  return (
    order.payment_method === PaymentMethod.COD &&
    order.order_status === OrderStatus.WAITING_MEETUP &&
    order.payment_status === PaymentStatus.PENDING
  )
}

/**
 * Check if order can be completed
 */
export function canCompleteOrder(order: OrderState): boolean {
  return (
    order.order_status === OrderStatus.PAID &&
    order.payment_status === PaymentStatus.PAID
  )
}

/**
 * Check if order can be approved
 */
export function canApproveOrder(order: OrderState): boolean {
  return order.order_status === OrderStatus.PENDING
}

/**
 * Check if order can be rejected
 */
export function canRejectOrder(order: OrderState): boolean {
  return order.order_status === OrderStatus.PENDING
}

/**
 * Get available actions for current order state
 */
export function getAvailableActions(order: OrderState): string[] {
  const actions: string[] = []
  
  if (canApproveOrder(order)) actions.push('approve_order', 'reject_order')
  if (canVerifyPayment(order)) actions.push('verify_payment')
  if (canMarkAsPaid(order)) actions.push('mark_as_paid')
  if (canCompleteOrder(order)) actions.push('complete_order')
  if (canCancelOrder(order)) actions.push('cancel_order')
  
  return actions
}
