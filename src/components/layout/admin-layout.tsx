'use client'

import { ReactNode } from 'react'
import { AuthWrapper } from '@/components/auth'
import { Navigation } from './navigation'
import { Header } from './header'

interface AdminLayoutProps {
  children: ReactNode
  requireAuth?: boolean
}

export function AdminLayout({ children, requireAuth = true }: AdminLayoutProps) {
  const content = (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <Header />
      
      <div className="flex flex-col md:flex-row">
        {/* Sidebar Navigation */}
        <Navigation />
        
        {/* Main Content */}
        <main className="flex-1 overflow-auto w-full">
          {children}
        </main>
      </div>
    </div>
  )

  if (!requireAuth) {
    return content
  }

  return (
    <AuthWrapper requireAdmin={true}>
      {content}
    </AuthWrapper>
  )
}