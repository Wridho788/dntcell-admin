'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import {
  updateNegotiationStatus,
  createCounterOffer,
  deleteNegotiation,
} from '@/lib/actions/negotiation-actions'
import type { NegotiationWithDetails } from '@/lib/validations/negotiation'
import { Check, X, MessageSquare, Trash2 } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

interface NegotiationActionsProps {
  negotiation: NegotiationWithDetails
  onUpdate?: () => void
}

export function NegotiationActions({ negotiation, onUpdate }: NegotiationActionsProps) {
  const queryClient = useQueryClient()
  const [counterModalOpen, setCounterModalOpen] = useState(false)
  const [counterPrice, setCounterPrice] = useState('')
  const [adminNote, setAdminNote] = useState('')
  const [rejectModalOpen, setRejectModalOpen] = useState(false)
  const [rejectNote, setRejectNote] = useState('')

  // Accept mutation
  const acceptMutation = useMutation({
    mutationFn: () =>
      updateNegotiationStatus({
        id: negotiation.id,
        status: 'accepted',
      }),
    onSuccess: (result) => {
      if (result.success) {
        toast.success('Offer accepted! Product status updated to sold.')
        queryClient.invalidateQueries({ queryKey: ['negotiations'] })
        queryClient.invalidateQueries({ queryKey: ['products'] })
        onUpdate?.()
      } else {
        toast.error(result.error || 'Failed to accept offer')
      }
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to accept offer')
    },
  })

  // Reject mutation
  const rejectMutation = useMutation({
    mutationFn: () =>
      updateNegotiationStatus({
        id: negotiation.id,
        status: 'rejected',
        admin_note: rejectNote || undefined,
      }),
    onSuccess: (result) => {
      if (result.success) {
        toast.success('Offer rejected')
        queryClient.invalidateQueries({ queryKey: ['negotiations'] })
        setRejectModalOpen(false)
        setRejectNote('')
        onUpdate?.()
      } else {
        toast.error(result.error || 'Failed to reject offer')
      }
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to reject offer')
    },
  })

  // Counter offer mutation
  const counterMutation = useMutation({
    mutationFn: () => {
      const price = parseInt(counterPrice)
      if (isNaN(price) || price <= 0) {
        throw new Error('Invalid counter price')
      }
      return createCounterOffer({
        id: negotiation.id,
        counter_price: price,
        admin_note: adminNote || undefined,
      })
    },
    onSuccess: (result) => {
      if (result.success) {
        toast.success('Counter offer sent')
        queryClient.invalidateQueries({ queryKey: ['negotiations'] })
        setCounterModalOpen(false)
        setCounterPrice('')
        setAdminNote('')
        onUpdate?.()
      } else {
        toast.error(result.error || 'Failed to send counter offer')
      }
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to send counter offer')
    },
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: () => deleteNegotiation(negotiation.id),
    onSuccess: (result) => {
      if (result.success) {
        toast.success('Negotiation deleted')
        queryClient.invalidateQueries({ queryKey: ['negotiations'] })
        onUpdate?.()
      } else {
        toast.error(result.error || 'Failed to delete negotiation')
      }
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete negotiation')
    },
  })

  const handleAccept = () => {
    if (confirm('Accept this offer? The product will be marked as sold.')) {
      acceptMutation.mutate()
    }
  }

  const handleReject = () => {
    setRejectModalOpen(true)
  }

  const handleCounter = () => {
    setCounterModalOpen(true)
  }

  const handleDelete = () => {
    if (confirm('Delete this negotiation? This action cannot be undone.')) {
      deleteMutation.mutate()
    }
  }

  // Don't show actions if already accepted or rejected
  if (negotiation.status === 'accepted' || negotiation.status === 'rejected') {
    return null
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="default"
          onClick={handleAccept}
          disabled={acceptMutation.isPending}
        >
          <Check className="mr-1 h-4 w-4" />
          Accept
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={handleCounter}
          disabled={counterMutation.isPending}
        >
          <MessageSquare className="mr-1 h-4 w-4" />
          Counter
        </Button>
        <Button
          size="sm"
          variant="destructive"
          onClick={handleReject}
          disabled={rejectMutation.isPending}
        >
          <X className="mr-1 h-4 w-4" />
          Reject
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleDelete}
          disabled={deleteMutation.isPending}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Counter Offer Modal */}
      <Dialog open={counterModalOpen} onOpenChange={setCounterModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Make Counter Offer</DialogTitle>
            <DialogDescription>
              Buyer offered {formatCurrency(negotiation.offer_price)}. Enter your counter price.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="counter-price">Counter Price (Rp)</Label>
              <Input
                id="counter-price"
                type="number"
                placeholder="2000000"
                value={counterPrice}
                onChange={(e) => setCounterPrice(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-note">Note (Optional)</Label>
              <Textarea
                id="admin-note"
                placeholder="Add a note to the buyer..."
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCounterModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => counterMutation.mutate()}
              disabled={counterMutation.isPending || !counterPrice}
            >
              {counterMutation.isPending ? 'Sending...' : 'Send Counter Offer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Modal */}
      <Dialog open={rejectModalOpen} onOpenChange={setRejectModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Offer</DialogTitle>
            <DialogDescription>
              Are you sure you want to reject this offer from {negotiation.buyer?.email}?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reject-note">Reason (Optional)</Label>
              <Textarea
                id="reject-note"
                placeholder="Add a reason for rejection..."
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => rejectMutation.mutate()}
              disabled={rejectMutation.isPending}
            >
              {rejectMutation.isPending ? 'Rejecting...' : 'Reject Offer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
