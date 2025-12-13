'use client'

import { AdminLayout } from '@/components/layout'
import { ProductForm } from '@/components/products/product-form'
import { AuthWrapper } from '@/components/auth'

export default function NewProductPage() {
  return (
    <AuthWrapper requireAdmin={true}>
      <AdminLayout>
        <div className="space-y-6 mx-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Buat Produk Baru</h1>
            <p className="text-muted-foreground">
              Tambahkan produk baru ke katalog Anda
            </p>
          </div>
          
          <ProductForm mode="create" />
        </div>
      </AdminLayout>
    </AuthWrapper>
  )
}