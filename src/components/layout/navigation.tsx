'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { logout } from '@/lib/auth/utils'
import { 
  Home,
  Users,
  Settings,
  Package,
  LogOut,
  ShoppingCart,
  MessageSquare
} from 'lucide-react'

const navigation = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: Home,
  },
  {
    name: 'Pengguna',
    href: '/users',
    icon: Users,
  },
  {
    name: 'Produk',
    href: '/products',
    icon: Package,
  },
  {
    name: 'Negosiasi',
    href: '/negotiations',
    icon: MessageSquare,
  },
  {
    name: 'Pesanan',
    href: '/orders',
    icon: ShoppingCart,
  },
  {
    name: 'Pengaturan',
    href: '/settings',
    icon: Settings,
  },
]

export function Navigation() {
  const pathname = usePathname()
  const router = useRouter()

  const handleLogout = async () => {
    try {
      await logout()
      router.push('/login')
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  return (
    <nav className="w-full md:w-64 bg-card border-r border-border">
      <div className="p-4 md:p-6">
        <div className="text-lg font-semibold text-foreground mb-4 md:mb-6">
          DNTCELL Admin
        </div>
        
        <ul className="space-y-1 md:space-y-2">
          {navigation.map((item) => {
            const isActive = pathname === item.href
            const Icon = item.icon
            
            return (
              <li key={item.name}>
                <Link
                  href={item.href}
                  className={cn(
                    'flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.name}</span>
                </Link>
              </li>
            )
          })}
          
          {/* Logout Button */}
          <li className="pt-4 border-t border-border mt-4">
            <button
              onClick={handleLogout}
              className="flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors w-full text-left text-muted-foreground hover:text-foreground hover:bg-accent"
            >
              <LogOut className="h-4 w-4" />
              <span>Logout</span>
            </button>
          </li>
        </ul>
      </div>
    </nav>
  )
}