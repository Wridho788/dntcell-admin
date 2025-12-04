/**
 * Suppress harmless errors from browser extensions
 * These errors don't affect app functionality
 */
export function suppressExtensionErrors() {
  if (typeof window === 'undefined') return

  const originalError = console.error
  console.error = (...args: any[]) => {
    const message = args[0]?.toString() || ''
    
    // Suppress known extension errors
    if (
      message.includes('message channel closed') ||
      message.includes('Extension context invalidated') ||
      message.includes('Could not establish connection')
    ) {
      return // Suppress these errors
    }
    
    originalError.apply(console, args)
  }
}
