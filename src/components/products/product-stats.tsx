'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Package, ShoppingCart, TrendingUp, AlertTriangle } from 'lucide-react'
import type { Product } from '@/lib/validations/product'
import type { DbProduct } from '@/lib/services/ProductService'
import { formatCurrency } from '@/lib/utils'

interface ProductStatsProps {
  total: number
  products: DbProduct[]
}

export function ProductStats({ total, products }: ProductStatsProps) {
  // Calculate stats
  const activeProducts = products.filter(p => p.status === 'active').length
  const lowStockProducts = products.filter(p => (p.details?.stock || 0) <= 10).length
  const totalValue = products.reduce((sum, p) => sum + (p.selling_price * (p.details?.stock || 0)), 0)
  const negotiableProducts = products.filter(p => p.negotiable).length

  const stats = [
    {
      title: 'Total Products',
      value: total.toLocaleString(),
      description: `${activeProducts} active`,
      icon: Package,
      trend: null,
    },
    {
      title: 'Negotiable Products',
      value: negotiableProducts.toLocaleString(),
      description: `${total > 0 ? ((negotiableProducts / total) * 100).toFixed(1) : 0}% of total`,
      icon: TrendingUp,
      trend: null,
    },
    {
      title: 'Inventory Value',
      value: formatCurrency(totalValue),
      description: 'Based on current stock',
      icon: ShoppingCart,
      trend: null,
    },
    {
      title: 'Low Stock Alert',
      value: lowStockProducts.toLocaleString(),
      description: 'Products ≤ 10 units',
      icon: AlertTriangle,
      trend: lowStockProducts > 0 ? 'warning' : null,
    },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
      {stats.map((stat) => {
        const Icon = stat.icon
        return (
          <Card key={stat.title}>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <Icon className={`h-4 w-4 ${
                  stat.trend === 'warning' 
                    ? 'text-destructive' 
                    : 'text-muted-foreground'
                }`} />
                <h3 className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </h3>
              </div>
              <div className="mt-2">
                <p className={`text-2xl font-bold ${
                  stat.trend === 'warning' ? 'text-destructive' : ''
                }`}>
                  {stat.value}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {stat.description}
                </p>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}