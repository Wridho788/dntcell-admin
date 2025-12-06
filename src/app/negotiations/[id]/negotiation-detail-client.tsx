"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { updateNegotiationStatus } from "@/lib/actions"
import { type NegotiationStatus } from "@/lib/validations/negotiation"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { LoadingCard } from "@/components/ui/loading"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import Link from "next/link"
import Image from "next/image"
import { ArrowLeft, User, Package, CheckCircle, XCircle, MessageSquare } from "lucide-react"

const negotiationStatusColors: Record<NegotiationStatus, string> = {
  pending: "bg-yellow-500",
  approved: "bg-green-500",
  rejected: "bg-red-500",
  countered: "bg-blue-500",
}

interface NegotiationDetailClientProps {
  negotiationId: string
}

export function NegotiationDetailClient({ negotiationId }: NegotiationDetailClientProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  
  const [showApproveDialog, setShowApproveDialog] = useState(false)
  const [showRejectDialog, setShowRejectDialog] = useState(false)
  const [finalPrice, setFinalPrice] = useState<string>("")
  const [rejectionNote, setRejectionNote] = useState<string>("")

  const { data: negotiation, isLoading, error } = useQuery({
    queryKey: ["negotiation", negotiationId],
    queryFn: async () => {
      // Fetch negotiation via server action
      const response = await fetch(`/api/negotiations/${negotiationId}`)
      if (!response.ok) {
        throw new Error("Failed to fetch negotiation")
      }
      return response.json()
    },
    staleTime: 30000,
  })

  const approveMutation = useMutation({
    mutationFn: async () => {
      const price = parseInt(finalPrice)
      if (isNaN(price) || price <= 0) {
        throw new Error("Please enter a valid final price")
      }

      const result = await updateNegotiationStatus({
        id: negotiationId,
        status: "approved",
        final_price: price,
      })

      if (!result.success) {
        throw new Error(result.error || "Failed to approve negotiation")
      }

      return result.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["negotiation", negotiationId] })
      queryClient.invalidateQueries({ queryKey: ["negotiations-list"] })
      toast.success("Negotiation approved successfully!")
      setShowApproveDialog(false)
      setFinalPrice("")
    },
    onError: (error: Error) => {
      toast.error(`Failed to approve: ${error.message}`)
    },
  })

  const rejectMutation = useMutation({
    mutationFn: async () => {
      const result = await updateNegotiationStatus({
        id: negotiationId,
        status: "rejected",
        note: rejectionNote || undefined,
      })

      if (!result.success) {
        throw new Error(result.error || "Failed to reject negotiation")
      }

      return result.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["negotiation", negotiationId] })
      queryClient.invalidateQueries({ queryKey: ["negotiations-list"] })
      toast.success("Negotiation rejected")
      setShowRejectDialog(false)
      setRejectionNote("")
    },
    onError: (error: Error) => {
      toast.error(`Failed to reject: ${error.message}`)
    },
  })

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(price)
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString("id-ID", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const handleApprove = () => {
    // Pre-fill with offer price
    if (negotiation && !finalPrice) {
      setFinalPrice(negotiation.offer_price.toString())
    }
    setShowApproveDialog(true)
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <LoadingCard />
      </div>
    )
  }

  if (error || !negotiation) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-red-500">
            Error loading negotiation: {error?.message || "Negotiation not found"}
          </p>
          <div className="text-center mt-4">
            <Link href="/negotiations">
              <Button variant="outline">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Negotiations
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    )
  }

  const isPending = negotiation.status === "pending"

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/negotiations">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Negotiation Details
            </h1>
            <p className="text-muted-foreground">
              Created on {formatDate(negotiation.created_at)}
            </p>
          </div>
        </div>
        
        {isPending && (
          <div className="flex gap-2">
            <Button
              variant="default"
              className="bg-green-600 hover:bg-green-700"
              onClick={handleApprove}
              disabled={approveMutation.isPending}
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Approve
            </Button>
            <Button
              variant="destructive"
              onClick={() => setShowRejectDialog(true)}
              disabled={rejectMutation.isPending}
            >
              <XCircle className="h-4 w-4 mr-2" />
              Reject
            </Button>
          </div>
        )}
      </div>

      {/* Status Badge */}
      <Card>
        <CardHeader>
          <CardTitle>Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-3">
            <Badge className={`${negotiationStatusColors[negotiation.status as NegotiationStatus]} text-lg px-4 py-2`}>
              {negotiation.status.toUpperCase()}
            </Badge>
            {negotiation.status === 'approved' && (
              <Badge variant={negotiation.used ? "destructive" : "default"} className="text-sm px-3 py-1">
                {negotiation.used ? "🔒 Used in Order" : "✓ Available for Order"}
              </Badge>
            )}
          </div>
          {negotiation.used && (
            <p className="text-sm text-muted-foreground mt-2">
              This negotiation has already been used to create an order and cannot be used again.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Product Information */}
        <Card>
          <CardHeader>
            <CardTitle>Product Information</CardTitle>
          </CardHeader>
          <CardContent>
            {negotiation.product && (
              <div className="space-y-4">
                {negotiation.product.main_image_url && (
                  <div className="relative aspect-video rounded-lg overflow-hidden">
                    <Image
                      src={negotiation.product.main_image_url}
                      alt={negotiation.product.name}
                      fill
                      className="object-cover"
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <div>
                    <label className="text-sm text-muted-foreground">Product Name</label>
                    <div className="font-semibold">{negotiation.product.name}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-muted-foreground">Base Price</label>
                      <div className="font-semibold">
                        {formatPrice(negotiation.product.base_price)}
                      </div>
                    </div>
                    <div>
                      <label className="text-sm text-muted-foreground">Selling Price</label>
                      <div className="font-semibold">
                        {formatPrice(negotiation.product.selling_price)}
                      </div>
                    </div>
                  </div>
                  <Link href={`/products/${negotiation.product.id}`}>
                    <Button variant="outline" size="sm" className="w-full">
                      <Package className="h-4 w-4 mr-2" />
                      View Product Details
                    </Button>
                  </Link>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Buyer Information */}
        <Card>
          <CardHeader>
            <CardTitle>Buyer Information</CardTitle>
          </CardHeader>
          <CardContent>
            {negotiation.buyer && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <div className="font-semibold">{negotiation.buyer.full_name || "Unknown"}</div>
                    <div className="text-sm text-muted-foreground">
                      {negotiation.buyer.email}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Negotiation Details */}
      <Card>
        <CardHeader>
          <CardTitle>Negotiation Details</CardTitle>
          <CardDescription>Price progression and negotiation history</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Price History Timeline */}
          <div className="mb-6 space-y-4">
            <h4 className="font-semibold text-sm text-muted-foreground">Price History</h4>
            <div className="space-y-3">
              {/* Original Product Price */}
              <div className="flex items-center gap-3 pl-4 border-l-2 border-muted">
                <div className="flex-1">
                  <div className="text-sm font-medium">Original Selling Price</div>
                  <div className="text-xs text-muted-foreground">Set by seller</div>
                </div>
                <div className="text-lg font-semibold">
                  {negotiation.product && formatPrice(negotiation.product.selling_price)}
                </div>
              </div>

              {/* Buyer Offer */}
              <div className="flex items-center gap-3 pl-4 border-l-2 border-blue-500">
                <div className="flex-1">
                  <div className="text-sm font-medium text-blue-600">Buyer's Offer</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(negotiation.created_at).toLocaleString('id-ID')}
                  </div>
                </div>
                <div className="text-lg font-bold text-blue-600">
                  {formatPrice(negotiation.offer_price)}
                </div>
              </div>

              {/* Counter Offer (if exists) */}
              {negotiation.counter_price && (
                <div className="flex items-center gap-3 pl-4 border-l-2 border-amber-500">
                  <div className="flex-1">
                    <div className="text-sm font-medium text-amber-600">Seller's Counter Offer</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(negotiation.updated_at).toLocaleString('id-ID')}
                    </div>
                  </div>
                  <div className="text-lg font-bold text-amber-600">
                    {formatPrice(negotiation.counter_price)}
                  </div>
                </div>
              )}

              {/* Final Price (if approved) */}
              {negotiation.final_price && negotiation.status === 'approved' && (
                <div className="flex items-center gap-3 pl-4 border-l-2 border-green-500">
                  <div className="flex-1">
                    <div className="text-sm font-medium text-green-600">✓ Final Agreed Price</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(negotiation.updated_at).toLocaleString('id-ID')}
                    </div>
                  </div>
                  <div className="text-xl font-bold text-green-600">
                    {formatPrice(negotiation.final_price)}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Summary Grid */}
          <div className="grid gap-4 md:grid-cols-2 pt-4 border-t">
            <div>
              <label className="text-sm text-muted-foreground">Offer Price</label>
              <div className="text-2xl font-bold text-blue-600">
                {formatPrice(negotiation.offer_price)}
              </div>
            </div>
            {negotiation.final_price && (
              <div>
                <label className="text-sm text-muted-foreground">Final Price</label>
                <div className="text-2xl font-bold text-green-600">
                  {formatPrice(negotiation.final_price)}
                </div>
              </div>
            )}
            {negotiation.counter_price && (
              <div>
                <label className="text-sm text-muted-foreground">Counter Offer</label>
                <div className="text-xl font-semibold">
                  {formatPrice(negotiation.counter_price)}
                </div>
              </div>
            )}
          </div>

          {(negotiation.note || negotiation.admin_note) && (
            <div className="mt-4">
              <label className="text-sm text-muted-foreground mb-2 block">
                Admin Note
              </label>
              <div className="p-3 bg-muted rounded-md">
                {negotiation.note || negotiation.admin_note}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Approve Dialog */}
      <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Negotiation</DialogTitle>
            <DialogDescription>
              Set the final price for this negotiation. The buyer will be notified.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-2 block">
                Final Price (IDR)
              </label>
              <Input
                type="number"
                placeholder="Enter final price"
                value={finalPrice}
                onChange={(e) => setFinalPrice(e.target.value)}
              />
              <p className="text-sm text-muted-foreground mt-1">
                Offer price: {formatPrice(negotiation.offer_price)}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowApproveDialog(false)}
              disabled={approveMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={() => approveMutation.mutate()}
              disabled={approveMutation.isPending || !finalPrice}
              className="bg-green-600 hover:bg-green-700"
            >
              {approveMutation.isPending ? "Approving..." : "Approve Negotiation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Negotiation</DialogTitle>
            <DialogDescription>
              Optionally provide a reason for rejection. The buyer will be notified.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-2 block">
                Rejection Note (Optional)
              </label>
              <Textarea
                placeholder="Enter reason for rejection..."
                value={rejectionNote}
                onChange={(e) => setRejectionNote(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowRejectDialog(false)}
              disabled={rejectMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => rejectMutation.mutate()}
              disabled={rejectMutation.isPending}
            >
              {rejectMutation.isPending ? "Rejecting..." : "Reject Negotiation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
