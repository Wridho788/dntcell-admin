/**
 * Negotiation State Machine
 * Single source of truth for negotiation status transitions
 * Prevents invalid state transitions and ensures trust & consistency
 */

export type NegotiationStatus = 'pending' | 'countered' | 'approved' | 'rejected'

/**
 * Check if negotiation can be approved from current status
 */
export function canApprove(currentStatus: NegotiationStatus): boolean {
  return currentStatus === 'pending' || currentStatus === 'countered'
}

/**
 * Check if negotiation can be rejected from current status
 */
export function canReject(currentStatus: NegotiationStatus): boolean {
  return currentStatus === 'pending' || currentStatus === 'countered'
}

/**
 * Check if negotiation can receive counter offer from current status
 */
export function canCounter(currentStatus: NegotiationStatus): boolean {
  return currentStatus === 'pending' || currentStatus === 'countered'
}

/**
 * Validate status transition
 * @param from Current status
 * @param to Target status
 * @returns true if transition is valid
 */
export function isValidTransition(from: NegotiationStatus, to: NegotiationStatus): boolean {
  const validTransitions: Record<NegotiationStatus, NegotiationStatus[]> = {
    pending: ['countered', 'approved', 'rejected'],
    countered: ['approved', 'rejected', 'countered'], // Can send multiple counters
    approved: [], // Final state
    rejected: [], // Final state
  }

  return validTransitions[from]?.includes(to) ?? false
}

/**
 * Get allowed actions for current status
 */
export function getAllowedActions(currentStatus: NegotiationStatus): string[] {
  const actions: string[] = []
  
  if (canApprove(currentStatus)) {
    actions.push('approve')
  }
  
  if (canReject(currentStatus)) {
    actions.push('reject')
  }
  
  if (canCounter(currentStatus)) {
    actions.push('counter')
  }
  
  return actions
}

/**
 * Check if status is final (no more transitions allowed)
 */
export function isFinalStatus(status: NegotiationStatus): boolean {
  return status === 'approved' || status === 'rejected'
}
