/**
 * Negotiation State Machine
 * Defines valid states and transitions for negotiation workflow
 */

export enum NegotiationStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  COUNTERED = 'countered',
}

/**
 * Valid state transitions for negotiations
 * Maps current state to allowed next states
 */
const STATE_TRANSITIONS: Record<NegotiationStatus, NegotiationStatus[]> = {
  [NegotiationStatus.PENDING]: [
    NegotiationStatus.APPROVED,
    NegotiationStatus.REJECTED,
    NegotiationStatus.COUNTERED,
  ],
  [NegotiationStatus.COUNTERED]: [
    NegotiationStatus.APPROVED,
    NegotiationStatus.REJECTED,
  ],
  [NegotiationStatus.APPROVED]: [],
  [NegotiationStatus.REJECTED]: [],
}

/**
 * Check if a state transition is valid
 * @param fromState Current state
 * @param toState Target state
 * @returns True if transition is valid
 */
export function isValidTransition(
  fromState: string,
  toState: NegotiationStatus
): boolean {
  const from = fromState as NegotiationStatus
  const allowedTransitions = STATE_TRANSITIONS[from]
  
  if (!allowedTransitions) {
    return false
  }
  
  return allowedTransitions.includes(toState)
}

/**
 * Get allowed next states for a given state
 * @param currentState Current negotiation state
 * @returns Array of allowed next states
 */
export function getAllowedTransitions(
  currentState: string
): NegotiationStatus[] {
  const state = currentState as NegotiationStatus
  return STATE_TRANSITIONS[state] || []
}

/**
 * Check if a state is terminal (no further transitions allowed)
 * @param state State to check
 * @returns True if state is terminal
 */
export function isTerminalState(state: string): boolean {
  const negotiationState = state as NegotiationStatus
  return STATE_TRANSITIONS[negotiationState]?.length === 0
}
