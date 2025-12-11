'use client'

import { QueryProvider } from './query-provider'
import { ThemeProvider } from './theme-provider'
import { OneSignalProvider } from './onesignal-provider'
import { Toaster } from 'sonner'

interface ProvidersProps {
  children: React.ReactNode
}

export function Providers({ children }: ProvidersProps) {
  return (
    <ThemeProvider
      defaultTheme="system"
    >
      <QueryProvider>
        <OneSignalProvider />
        {children}
        <Toaster
          position="top-right"
          richColors
          closeButton
          expand={true}
          duration={4000}
        />
      </QueryProvider>
    </ThemeProvider>
  )
}

export * from './query-provider'
export * from './theme-provider'
export * from './onesignal-provider'