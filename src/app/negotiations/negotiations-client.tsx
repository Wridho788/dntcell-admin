"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { searchNegotiations } from "@/lib/actions"
import { type NegotiationStatus } from "@/lib/validations/negotiation"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { LoadingCard } from "@/components/ui/loading"
import { Skeleton } from "@/components/ui/skeleton"
import Link from "next/link"
import { Eye, MessageSquare, TrendingUp, CheckCircle, XCircle } from "lucide-react"

const negotiationStatusColors: Record<NegotiationStatus, string> = {
  pending: "bg-yellow-500",
  approved: "bg-green-500",
  rejected: "bg-red-500",
  countered: "bg-blue-500",
}

export function NegotiationsClient() {
  const [statusFilter, setStatusFilter] = useState<NegotiationStatus | "all">("all")
  const [timeFilter, setTimeFilter] = useState<"today" | "week" | "all">("all")
  const [page, setPage] = useState(1)
  const limit = 10

  const { data, isLoading, error } = useQuery({
    queryKey: ["negotiations-list", { page, limit, status: statusFilter }],
    queryFn: async () => {
      const result = await searchNegotiations({
        page,
        limit,
        status: statusFilter !== "all" ? statusFilter : undefined,
        sort_by: "created_at",
        sort_order: "desc",
      })

      if (!result.success || !result.data) {
        throw new Error(result.error || "Failed to fetch negotiations")
      }

      return result.data
    },
    staleTime: 30000,
  })

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(price)
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("id-ID", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const totalPages = data ? Math.ceil(data.total / limit) : 0

  // Calculate stats
  const stats = {
    total: data?.total || 0,
    pending: data?.negotiations.filter((n) => n.status === "pending").length || 0,
    approved: data?.negotiations.filter((n) => n.status === "approved").length || 0,
    rejected: data?.negotiations.filter((n) => n.status === "rejected").length || 0,
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-24 w-full" />
        <div className="grid gap-4 md:grid-cols-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-red-500">
            Error loading negotiations: {error.message}
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">Negotiations</h1>
        <p className="page-description">
          Manage price negotiations with customers
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <TrendingUp className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {stats.pending}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approved</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {stats.approved}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rejected</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {stats.rejected}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Filter negotiations by status and time</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium mb-2 block">Status</label>
              <Select
                value={statusFilter}
                onValueChange={(value) => {
                  setStatusFilter(value as NegotiationStatus | "all")
                  setPage(1)
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="countered">Countered</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium mb-2 block">Time Range</label>
              <Select
                value={timeFilter}
                onValueChange={(value) => {
                  setTimeFilter(value as "today" | "week" | "all")
                  setPage(1)
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All time" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">This Week</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Negotiations Table */}
      <Card>
        <CardHeader>
          <CardTitle>Negotiations ({data?.total || 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {data?.negotiations.length === 0 ? (
            <div className="text-center py-12">
              <MessageSquare className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">No negotiations found</h3>
              <p className="text-muted-foreground mt-2">
                No negotiations match the current filters.
              </p>
            </div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Offer Price</TableHead>
                      <TableHead>Final Price</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Used</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data?.negotiations.map((negotiation) => (
                      <TableRow key={negotiation.id}>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="font-medium">
                              {negotiation.buyer?.full_name || "Unknown"}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {negotiation.buyer?.email}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">
                            {negotiation.product?.name || "Unknown Product"}
                          </div>
                        </TableCell>
                        <TableCell className="font-semibold">
                          {formatPrice(negotiation.offer_price)}
                        </TableCell>
                        <TableCell>
                          {negotiation.final_price ? (
                            <span className="font-semibold text-green-600">
                              {formatPrice(negotiation.final_price)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={negotiationStatusColors[negotiation.status]}
                          >
                            {negotiation.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {negotiation.status === 'approved' && (
                            negotiation.used ? (
                              <Badge variant="outline" className="border-red-500 text-red-500">
                                🔒 Used
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="border-green-500 text-green-500">
                                ✓ Available
                              </Badge>
                            )
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {formatDate(negotiation.created_at)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Link href={`/negotiations/${negotiation.id}`}>
                            <Button variant="ghost" size="sm">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-muted-foreground">
                    Page {page} of {totalPages}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
