'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { X } from 'lucide-react'
import type { ProductSearch } from '@/lib/validations/product'

interface ProductFiltersProps {
  filters: ProductSearch
  onFiltersChange: (updates: Partial<ProductSearch>) => void
}

export function ProductFilters({ filters, onFiltersChange }: ProductFiltersProps) {
  const [localFilters, setLocalFilters] = useState({
    minPrice: filters.min_price?.toString() || '',
    maxPrice: filters.max_price?.toString() || '',
  })

  const handlePriceChange = (field: 'minPrice' | 'maxPrice', value: string) => {
    setLocalFilters(prev => ({ ...prev, [field]: value }))
    
    const numValue = parseFloat(value)
    if (!isNaN(numValue) && numValue >= 0) {
      onFiltersChange({
        [field === 'minPrice' ? 'min_price' : 'max_price']: numValue,
        page: 1
      })
    } else if (value === '') {
      onFiltersChange({
        [field === 'minPrice' ? 'min_price' : 'max_price']: undefined,
        page: 1
      })
    }
  }

  const clearFilters = () => {
    setLocalFilters({ minPrice: '', maxPrice: '' })
    onFiltersChange({
      status: undefined,
      condition: undefined,
      min_price: undefined,
      max_price: undefined,
      negotiable: undefined,
      page: 1,
    })
  }

  const hasActiveFilters = 
    filters.status ||
    filters.condition ||
    filters.negotiable !== undefined ||
    filters.min_price ||
    filters.max_price

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 p-4 bg-muted/50 rounded-lg">
      {/* Status Filter */}
      <div className="space-y-2">
        <Label>Status</Label>
        <Select
          value={filters.status || 'all'}
          onValueChange={(value) =>
            onFiltersChange({
              status: value === 'all' ? undefined : (value as any),
              page: 1,
            })
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="pending_review">Pending Review</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Kondisi Filter */}
      <div className="space-y-2">
        <Label>Kondisi Barang</Label>
        <Select
          value={filters.condition || 'all'}
          onValueChange={(value) =>
            onFiltersChange({
              condition: value === 'all' ? undefined : (value as any),
              page: 1,
            })
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="All conditions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Kondisi</SelectItem>
            <SelectItem value="new">Baru</SelectItem>
            <SelectItem value="like_new">Seperti Baru</SelectItem>
            <SelectItem value="good">Baik</SelectItem>
            <SelectItem value="fair">Cukup</SelectItem>
            <SelectItem value="poor">Kurang Baik</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Negotiable Filter */}
      <div className="space-y-2">
        <Label>Negotiable</Label>
        <div className="flex items-center space-x-2">
          <Switch
            checked={filters.negotiable === true}
            onCheckedChange={(checked) =>
              onFiltersChange({
                negotiable: checked ? true : undefined,
                page: 1,
              })
            }
          />
          <Label className="text-sm text-muted-foreground">
            Show only negotiable
          </Label>
        </div>
      </div>

      {/* Price Range */}
      <div className="space-y-2">
        <Label>Min Price</Label>
        <Input
          type="number"
          placeholder="0.00"
          value={localFilters.minPrice}
          onChange={(e) => handlePriceChange('minPrice', e.target.value)}
          min="0"
          step="0.01"
        />
      </div>

      <div className="space-y-2">
        <Label>Max Price</Label>
        <Input
          type="number"
          placeholder="999999.99"
          value={localFilters.maxPrice}
          onChange={(e) => handlePriceChange('maxPrice', e.target.value)}
          min="0"
          step="0.01"
        />
      </div>

      {/* Clear Filters */}
      {hasActiveFilters && (
        <div className="lg:col-span-5 pt-2">
          <Button
            variant="outline"
            onClick={clearFilters}
            className="w-full"
          >
            <X className="mr-2 h-4 w-4" />
            Clear all filters
          </Button>
        </div>
      )}
    </div>
  )
}