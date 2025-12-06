'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { LoadingCard } from '@/components/ui/loading'
import { Pagination } from '@/components/ui/pagination'
import {
  MoreHorizontal,
  Edit,
  Trash2,
  Copy,
  Eye,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  Plus,
  Package,
} from 'lucide-react'
import { productService } from '@/lib/services'
import { toast } from 'sonner'
import type { Product, ProductSearch } from '@/lib/validations/product'
import { formatCurrency } from '@/lib/utils'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface ProductsTableProps {
  products: any[]
  isLoading: boolean
  onRefresh: () => void
  searchParams: any
  onSearchParamsChange: (updates: any) => void
  totalProducts: number
  totalPages: number
}

export function ProductsTable({
  products,
  isLoading,
  onRefresh,
  searchParams,
  onSearchParamsChange,
  totalProducts,
  totalPages,
}: ProductsTableProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [selectedProducts, setSelectedProducts] = useState<string[]>([])
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [productToDelete, setProductToDelete] = useState<string | null>(null)

  // Mutations
  const deleteMutation = useMutation({
    mutationFn: (id: string) => productService.deleteProduct(id),
    onSuccess: (result) => {
      if (result.success) {
        toast.success('Product deactivated successfully')
        queryClient.invalidateQueries({ queryKey: ['products'] })
        onRefresh()
      } else {
        toast.error(result.error || 'Failed to deactivate product')
      }
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to deactivate product')
    },
  })



  const bulkActionMutation = useMutation({
    mutationFn: ({ action, product_ids }: { action: string; product_ids: string[] }) => {
      const isActive = action === 'activate'
      return productService.bulkUpdateStatus(product_ids, isActive)
    },
    onSuccess: (result) => {
      if (result.success) {
        toast.success('Bulk action completed successfully')
        setSelectedProducts([])
        queryClient.invalidateQueries({ queryKey: ['products'] })
        onRefresh()
      } else {
        toast.error(result.error || 'Bulk action failed')
      }
    },
    onError: (error: any) => {
      toast.error(error.message || 'Bulk action failed')
    },
  })

  // Handle selection
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedProducts(products.map(p => p.id!))
    } else {
      setSelectedProducts([])
    }
  }

  const handleSelectProduct = (productId: string, checked: boolean) => {
    if (checked) {
      setSelectedProducts([...selectedProducts, productId])
    } else {
      setSelectedProducts(selectedProducts.filter(id => id !== productId))
    }
  }

  // Handle actions
  const handleEdit = (productId: string) => {
    router.push(`/products/${productId}/edit`)
  }

  const handleView = (productId: string) => {
    router.push(`/products/${productId}`)
  }

  const handleDelete = (productId: string) => {
    setProductToDelete(productId)
    setDeleteDialogOpen(true)
  }

  const confirmDelete = () => {
    if (productToDelete) {
      deleteMutation.mutate(productToDelete)
      setDeleteDialogOpen(false)
      setProductToDelete(null)
    }
  }



  const handleBulkAction = (action: string) => {
    if (selectedProducts.length === 0) {
      toast.error('Please select at least one product')
      return
    }

    bulkActionMutation.mutate({
      action,
      product_ids: selectedProducts,
    })
  }

  // Handle sorting
  const handleSort = (field: string) => {
    const isCurrentSort = searchParams.sort_by === field
    const newOrder = isCurrentSort && searchParams.sort_order === 'asc' ? 'desc' : 'asc'
    
    onSearchParamsChange({
      sort_by: field as any,
      sort_order: newOrder,
    })
  }

  // Handle pagination
  const handlePageChange = (page: number) => {
    onSearchParamsChange({ page })
  }

  const handlePageSizeChange = (pageSize: number) => {
    onSearchParamsChange({ 
      limit: pageSize,
      page: 1 // Reset to first page when changing page size
    })
  }

  // Get status badge variant
  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'draft': return 'outline'
      case 'pending_review': return 'default'
      case 'approved': return 'default'
      case 'rejected': return 'destructive'
      case 'active': return 'default'
      case 'inactive': return 'secondary'
      case 'archived': return 'destructive'
      default: return 'secondary'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'draft': return 'Draft'
      case 'pending_review': return 'Pending Review'
      case 'approved': return 'Disetujui'
      case 'rejected': return 'Ditolak'
      case 'active': return 'Active'
      case 'inactive': return 'Inactive'
      case 'archived': return 'Archived'
      default: return status
    }
  }

  if (isLoading) {
    return <LoadingCard text="Loading products..." />
  }

  const allSelected = selectedProducts.length === products.length && products.length > 0
  const someSelected = selectedProducts.length > 0

  return (
    <div className="space-y-4">
      {/* Bulk Actions */}
      {someSelected && (
        <div className="flex items-center space-x-2 p-4 bg-muted rounded-md">
          <span className="text-sm font-medium">
            {selectedProducts.length} product(s) selected
          </span>
          <div className="flex space-x-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleBulkAction('activate')}
            >
              Activate
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleBulkAction('deactivate')}
            >
              Deactivate
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleBulkAction('archive')}
            >
              Archive
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => handleBulkAction('delete')}
            >
              Delete
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">
              <Checkbox
                checked={allSelected}
                onCheckedChange={handleSelectAll}
              />
            </TableHead>
            <TableHead className="w-20">Image</TableHead>
            <TableHead>
              <Button
                variant="ghost"
                onClick={() => handleSort('name')}
                className="h-auto p-0 font-semibold"
              >
                Name
                <ArrowUpDown className="ml-2 h-4 w-4" />
              </Button>
            </TableHead>
            <TableHead>Category</TableHead>
            <TableHead>
              <Button
                variant="ghost"
                onClick={() => handleSort('base_price')}
                className="h-auto p-0 font-semibold"
              >
                Base Price
                <ArrowUpDown className="ml-2 h-4 w-4" />
              </Button>
            </TableHead>
            <TableHead>
              <Button
                variant="ghost"
                onClick={() => handleSort('selling_price')}
                className="h-auto p-0 font-semibold"
              >
                Selling Price
                <ArrowUpDown className="ml-2 h-4 w-4" />
              </Button>
            </TableHead>
            <TableHead>Margin</TableHead>
            <TableHead>Kondisi</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Negotiable</TableHead>
            <TableHead>Active</TableHead>
            <TableHead>
              <Button
                variant="ghost"
                onClick={() => handleSort('created_at')}
                className="h-auto p-0 font-semibold"
              >
                Created
                <ArrowUpDown className="ml-2 h-4 w-4" />
              </Button>
            </TableHead>
            <TableHead className="w-12">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.map((product: any) => {
            const isSelected = selectedProducts.includes(product.id!)
            const stock = product.details?.stock || 0

            return (
              <TableRow key={product.id}>
                <TableCell>
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={(checked) => handleSelectProduct(product.id!, checked as boolean)}
                  />
                </TableCell>
                <TableCell>
                  {product.main_image_url ? (
                    <img
                      src={product.main_image_url}
                      alt={product.name}
                      className="w-12 h-12 object-cover rounded-md"
                      onError={(e) => {
                        // Hide broken image and show fallback
                        e.currentTarget.style.display = 'none'
                        if (e.currentTarget.nextElementSibling) {
                          e.currentTarget.nextElementSibling.classList.remove('hidden')
                        }
                      }}
                    />
                  ) : null}
                  {/* Fallback shown when no URL or image fails to load */}
                  <div 
                    className={`w-12 h-12 bg-muted rounded-md flex items-center justify-center ${product.main_image_url ? 'hidden' : ''}`}
                    title={product.main_image_url ? `Failed to load: ${product.main_image_url}` : 'No image'}
                  >
                    <span className="text-xs text-muted-foreground">No image</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div>
                    <div className="font-medium">{product.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {product.condition}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-sm">
                  {product.category_id || 'Uncategorized'}
                </TableCell>
                <TableCell>
                  <div className="font-medium">{formatCurrency(product.base_price)}</div>
                </TableCell>
                <TableCell>
                  <div className="font-medium">{formatCurrency(product.selling_price)}</div>
                </TableCell>
                <TableCell>
                  {(() => {
                    const margin = product.selling_price - product.base_price
                    const marginColor = margin >= 300000 ? 'text-green-600' : margin >= 100000 ? 'text-yellow-600' : 'text-red-600'
                    const marginStatus = margin >= 300000 ? 'Margin tinggi - Profit bagus' : margin >= 100000 ? 'Margin standar' : 'Margin rendah - Dapat mengurangi profit'
                    return (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className={`font-medium cursor-help ${marginColor}`}>
                              {formatCurrency(margin)}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{marginStatus}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )
                  })()}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="capitalize">
                    {product.condition || 'new'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={getStatusVariant(product.status)}>
                    {getStatusLabel(product.status)}
                  </Badge>
                </TableCell>
                <TableCell>
                  {product.negotiable ? (
                    <Badge variant="outline" className="text-green-600 border-green-600">
                      Yes
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-gray-600 border-gray-600">
                      No
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={product.is_active ? 'default' : 'secondary'}>
                    {product.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <span className="text-sm text-muted-foreground">
                    {new Date(product.created_at!).toLocaleDateString()}
                  </span>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => handleView(product.id!)}>
                        <Eye className="mr-2 h-4 w-4" />
                        View
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleEdit(product.id!)}>
                        <Edit className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => handleDelete(product.id!)}
                        className="text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Deactivate
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>

      {/* Empty State */}
      {products.length === 0 && !isLoading && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Package className="h-16 w-16 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-semibold mb-2">No products found</h3>
          <p className="text-sm text-muted-foreground mb-6 max-w-sm">
            Get started by creating your first product. Products will appear here once added.
          </p>
          <Button
            onClick={() => router.push('/products/new')}
            size="lg"
          >
            <Plus className="mr-2 h-5 w-5" />
            Create your first product
          </Button>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate Product</AlertDialogTitle>
            <AlertDialogDescription>
              This will set the product as inactive. The product will no longer be visible 
              to customers but can be reactivated later. This is a soft delete operation.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Pagination */}
      {totalProducts > 0 && (
        <Pagination
          currentPage={searchParams.page || 1}
          totalPages={totalPages}
          pageSize={searchParams.limit || 20}
          totalItems={totalProducts}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
        />
      )}
    </div>
  )
}