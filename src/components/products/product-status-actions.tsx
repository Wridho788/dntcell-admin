'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { RejectProductDialog } from './reject-product-dialog'
import {
  submitProductForReview,
  approveProduct,
  changeProductToDraft,
} from '@/lib/actions/product-actions'
import { toast } from 'sonner'
import { 
  CheckCircle2, 
  XCircle, 
  Send, 
  Edit3,
  Loader2 
} from 'lucide-react'
import type { ProductStatus } from '@/lib/validations/product'

interface ProductStatusActionsProps {
  productId: string
  productName: string
  currentStatus: ProductStatus
  className?: string
}

export function ProductStatusActions({
  productId,
  productName,
  currentStatus,
  className = '',
}: ProductStatusActionsProps) {
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleSubmitForReview = async () => {
    setIsLoading(true)
    try {
      const result = await submitProductForReview(productId)
      if (result.success) {
        toast.success('Produk berhasil disubmit untuk review')
        router.refresh()
      } else {
        toast.error(result.error || 'Gagal submit produk')
      }
    } catch (error) {
      console.error('Error submitting product:', error)
      toast.error('Terjadi kesalahan saat submit produk')
    } finally {
      setIsLoading(false)
    }
  }

  const handleApprove = async () => {
    setIsLoading(true)
    try {
      const result = await approveProduct(productId)
      if (result.success) {
        toast.success('Produk berhasil disetujui')
        router.refresh()
      } else {
        toast.error(result.error || 'Gagal menyetujui produk')
      }
    } catch (error) {
      console.error('Error approving product:', error)
      toast.error('Terjadi kesalahan saat menyetujui produk')
    } finally {
      setIsLoading(false)
    }
  }

  const handleChangeToDraft = async () => {
    setIsLoading(true)
    try {
      const result = await changeProductToDraft(productId)
      if (result.success) {
        toast.success('Status berhasil diubah ke Draft')
        router.refresh()
      } else {
        toast.error(result.error || 'Gagal mengubah status')
      }
    } catch (error) {
      console.error('Error changing status:', error)
      toast.error('Terjadi kesalahan saat mengubah status')
    } finally {
      setIsLoading(false)
    }
  }

  // Render buttons based on current status
  const renderActions = () => {
    if (isLoading) {
      return (
        <Button disabled size="sm">
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          Loading...
        </Button>
      )
    }

    switch (currentStatus) {
      case 'available':
        return (
          <div className="flex items-center gap-2">
            <div className="text-sm text-green-600 font-medium">
              ✓ Produk Tersedia
            </div>
            <Button 
              onClick={() => router.push(`/products/${productId}/edit`)} 
              size="sm"
              variant="outline"
            >
              <Edit3 className="w-4 h-4 mr-2" />
              Edit
            </Button>
          </div>
        )

      case 'unavailable':
        return (
          <div className="flex items-center gap-2">
            <div className="text-sm text-orange-600 font-medium">
              ⚠ Produk Tidak Tersedia
            </div>
            <Button 
              onClick={() => router.push(`/products/${productId}/edit`)} 
              size="sm"
              variant="outline"
            >
              <Edit3 className="w-4 h-4 mr-2" />
              Edit
            </Button>
          </div>
        )

      case 'sold':
        return (
          <div className="flex items-center gap-2">
            <div className="text-sm text-blue-600 font-medium">
              ✓ Produk Terjual
            </div>
            <Button 
              onClick={() => router.push(`/products/${productId}`)} 
              size="sm"
              variant="outline"
              disabled
            >
              Lihat Detail
            </Button>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className={className}>
      {renderActions()}
      
      <RejectProductDialog
        productId={productId}
        productName={productName}
        open={isRejectDialogOpen}
        onOpenChange={setIsRejectDialogOpen}
      />
    </div>
  )
}
