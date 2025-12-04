'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { rejectProduct } from '@/lib/actions/product-actions'
import { toast } from 'sonner'

interface RejectProductDialogProps {
  productId: string
  productName: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function RejectProductDialog({
  productId,
  productName,
  open,
  onOpenChange,
}: RejectProductDialogProps) {
  const [rejectNote, setRejectNote] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const router = useRouter()

  const handleReject = async () => {
    if (rejectNote.trim().length < 10) {
      toast.error('Alasan penolakan minimal 10 karakter')
      return
    }

    setIsSubmitting(true)
    try {
      const result = await rejectProduct(productId, rejectNote)
      
      if (result.success) {
        toast.success('Produk berhasil ditolak')
        setRejectNote('')
        onOpenChange(false)
        router.refresh()
      } else {
        toast.error(result.error || 'Gagal menolak produk')
      }
    } catch (error) {
      console.error('Error rejecting product:', error)
      toast.error('Terjadi kesalahan saat menolak produk')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>Tolak Produk</AlertDialogTitle>
          <AlertDialogDescription>
            Anda akan menolak produk <strong>{productName}</strong>. 
            Berikan alasan penolakan agar seller dapat memperbaiki produk.
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <div className="space-y-2 py-4">
          <Label htmlFor="reject-note">
            Alasan Penolakan <span className="text-red-500">*</span>
          </Label>
          <Textarea
            id="reject-note"
            placeholder="Misal: Deskripsi produk kurang lengkap, foto produk tidak jelas, harga tidak sesuai standar, dll."
            value={rejectNote}
            onChange={(e) => setRejectNote(e.target.value)}
            rows={5}
            className="resize-none"
            disabled={isSubmitting}
          />
          <p className="text-xs text-muted-foreground">
            {rejectNote.length}/500 karakter (minimal 10)
          </p>
        </div>

        <AlertDialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              setRejectNote('')
              onOpenChange(false)
            }}
            disabled={isSubmitting}
          >
            Batal
          </Button>
          <Button
            variant="destructive"
            onClick={handleReject}
            disabled={isSubmitting || rejectNote.trim().length < 10}
          >
            {isSubmitting ? 'Menolak...' : 'Tolak Produk'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
