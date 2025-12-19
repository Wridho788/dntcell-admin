/**
 * Order State Machine
 * Defines valid states and transitions for order workflow
 * BACKEND ONLY - Admin panel does NOT control state transitions
 */

export enum OrderStatus {
  PENDING_PAYMENT = 'pending_payment',
  PAID = 'paid',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum PaymentStatus {
  UNPAID = 'unpaid',
  WAITING_CONFIRMATION = 'waiting_confirmation',
  PAID = 'paid',
  FAILED = 'failed',
}

export enum PaymentMethod {
  COD = 'cod',
  BANK_TRANSFER = 'bank_transfer',
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
  // CREATE ORDER - Initial state determination
  'create_order': (ctx) => {
    const { currentOrder } = ctx
    if (currentOrder.payment_method === PaymentMethod.COD) {
      return (
        currentOrder.order_status === OrderStatus.PROCESSING &&
        currentOrder.payment_status === PaymentStatus.UNPAID
      )
    } else if (currentOrder.payment_method === PaymentMethod.BANK_TRANSFER) {
      return (
        currentOrder.order_status === OrderStatus.PENDING_PAYMENT &&
        currentOrder.payment_status === PaymentStatus.UNPAID
      )
    }
    return false
  },

  // UPLOAD PAYMENT PROOF - User action for bank_transfer only
  'upload_payment_proof': (ctx) => {
    const { currentOrder, nextPaymentStatus, actor } = ctx
    return (
      actor === 'user' &&
      currentOrder.payment_method === PaymentMethod.BANK_TRANSFER &&
      currentOrder.order_status === OrderStatus.PENDING_PAYMENT &&
      currentOrder.payment_status === PaymentStatus.UNPAID &&
      nextPaymentStatus === PaymentStatus.WAITING_CONFIRMATION
    )
  },

  // APPROVE PAYMENT - Admin reviews and approves payment proof
  'approve_payment': (ctx) => {
    const { currentOrder, nextPaymentStatus, nextOrderStatus, actor } = ctx
    return (
      actor === 'admin' &&
      currentOrder.payment_status === PaymentStatus.WAITING_CONFIRMATION &&
      nextPaymentStatus === PaymentStatus.PAID &&
      nextOrderStatus === OrderStatus.PAID
    )
  },

  // REJECT PAYMENT - Admin rejects payment proof
  'reject_payment': (ctx) => {
    const { currentOrder, nextPaymentStatus, nextOrderStatus, actor } = ctx
    return (
      actor === 'admin' &&
      currentOrder.payment_status === PaymentStatus.WAITING_CONFIRMATION &&
      nextPaymentStatus === PaymentStatus.FAILED &&
      nextOrderStatus === OrderStatus.PENDING_PAYMENT
    )
  },

  // PROCESS ORDER - Admin starts processing
  'process_order': (ctx) => {
    const { currentOrder, nextOrderStatus, actor } = ctx
    return (
      actor === 'admin' &&
      currentOrder.payment_status === PaymentStatus.PAID &&
      currentOrder.order_status === OrderStatus.PAID &&
      nextOrderStatus === OrderStatus.PROCESSING
    )
  },

  // COMPLETE ORDER - Admin marks as completed
  'complete_order': (ctx) => {
    const { currentOrder, nextOrderStatus, nextPaymentStatus, actor } = ctx
    return (
      actor === 'admin' &&
      currentOrder.order_status === OrderStatus.PROCESSING &&
      nextOrderStatus === OrderStatus.COMPLETED &&
      nextPaymentStatus === PaymentStatus.PAID
    )
  },

  // CANCEL ORDER - User can cancel pending_payment, Admin can cancel pending_payment or processing
  'cancel_order': (ctx) => {
    const { currentOrder, nextOrderStatus, actor } = ctx
    
    if (nextOrderStatus !== OrderStatus.CANCELLED) {
      return false
    }

    if (actor === 'user') {
      return currentOrder.order_status === OrderStatus.PENDING_PAYMENT
    } else if (actor === 'admin') {
      return (
        currentOrder.order_status === OrderStatus.PENDING_PAYMENT ||
        currentOrder.order_status === OrderStatus.PROCESSING
      )
    }
    
    return false
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
 */
export function getInitialOrderState(paymentMethod: PaymentMethod): OrderState {
  if (paymentMethod === PaymentMethod.COD) {
    return {
      order_status: OrderStatus.PROCESSING,
      payment_status: PaymentStatus.UNPAID,
      payment_method: PaymentMethod.COD,
    }
  } else {
    return {
      order_status: OrderStatus.PENDING_PAYMENT,
      payment_status: PaymentStatus.UNPAID,
      payment_method: PaymentMethod.BANK_TRANSFER,
    }
  }
}

/**
 * Check if order can be cancelled by actor
 */
export function canCancelOrder(order: OrderState, actor: UserRole): boolean {
  try {
    assertOrderTransition({
      currentOrder: order,
      nextOrderStatus: OrderStatus.CANCELLED,
      actor,
      action: 'cancel_order',
    })
    return true
  } catch {
    return false
  }
}

/**
 * Check if payment proof can be uploaded
 */
export function canUploadPaymentProof(order: OrderState): boolean {
  try {
    assertOrderTransition({
      currentOrder: order,
      nextPaymentStatus: PaymentStatus.WAITING_CONFIRMATION,
      actor: 'user',
      action: 'upload_payment_proof',
    })
    return true
  } catch {
    return false
  }
}
