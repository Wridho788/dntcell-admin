'use client'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { NegotiationWithDetails } from '@/lib/validations/negotiation'
import { NegotiationActions } from './negotiation-actions'
import { User } from 'lucide-react'

interface NegotiationsTableProps {
  negotiations: NegotiationWithDetails[]
  onUpdate?: () => void
}

export function NegotiationsTable({ negotiations, onUpdate }: NegotiationsTableProps) {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300">Pending</Badge>
      case 'approved':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">Approved</Badge>
      case 'rejected':
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300">Rejected</Badge>
      case 'countered':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300">Countered</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  if (negotiations.length === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center text-muted-foreground">
            <User className="mx-auto h-12 w-12 mb-3 opacity-20" />
            <p>No negotiations yet</p>
            <p className="text-sm mt-1">Negotiations will appear here when buyers make offers</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Negotiations ({negotiations.length})</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Buyer</TableHead>
              <TableHead>Offer Price</TableHead>
              <TableHead>Counter Price</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Note</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {negotiations.map((negotiation) => (
              <TableRow key={negotiation.id}>
                <TableCell>
                  <div>
                    <div className="font-medium">
                      {negotiation.buyer?.full_name || 'Unknown'}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {negotiation.buyer?.email}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="font-semibold">
                    {formatCurrency(negotiation.offer_price)}
                  </div>
                  {negotiation.product && (
                    <div className="text-xs text-muted-foreground">
                      Selling price: {formatCurrency(negotiation.product.selling_price)}
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  {negotiation.counter_price ? (
                    <div className="font-semibold text-blue-600">
                      {formatCurrency(negotiation.counter_price)}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>{getStatusBadge(negotiation.status)}</TableCell>
                <TableCell>
                  <div className="text-sm">{formatDate(negotiation.created_at)}</div>
                  {negotiation.updated_at !== negotiation.created_at && (
                    <div className="text-xs text-muted-foreground">
                      Updated: {formatDate(negotiation.updated_at)}
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  {negotiation.admin_note ? (
                    <div className="text-sm max-w-xs truncate" title={negotiation.admin_note}>
                      {negotiation.admin_note}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <NegotiationActions negotiation={negotiation} onUpdate={onUpdate} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
