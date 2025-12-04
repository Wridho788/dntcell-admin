'use client'

import { QueryProvider } from './query-provider'
import { ThemeProvider } from './theme-provider'
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