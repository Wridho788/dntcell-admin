'use client'

import { useState, useEffect as React_useEffect } from 'react'
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ImageUpload } from '@/components/products/image-upload'
import { LoadingButton } from '@/components/ui/loading-button'
import { productService } from '@/lib/services'
import { createProductSchema, updateProductSchema, type CreateProductInput, type UpdateProductInput, type Product } from '@/lib/validations/product'
import type { DbProduct } from '@/lib/services/ProductService'
import { useCategories } from '@/hooks/use-categories'
import { toast } from 'sonner'
import { ArrowLeft, Save, X } from 'lucide-react'

interface ProductFormProps {
  mode: 'create' | 'edit'
  initialData?: DbProduct
  productId?: string
}

export function ProductForm({ mode, initialData, productId }: ProductFormProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [uploadedImages, setUploadedImages] = useState<Array<{ url: string; file?: File }>>(
    initialData?.main_image_url ? [{ url: initialData.main_image_url }] : []
  )

  // Fetch categories and locations
  const { data: categories = [], isLoading: categoriesLoading } = useCategories()
 
  // Use a simplified form schema that works for both create and edit
  const formSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    description: z.string().min(10, 'Description must be at least 10 characters'),
    base_price: z.number().positive('Base price must be positive'),
    selling_price: z.number().positive('Selling price must be positive'),
    negotiable: z.boolean().default(false),
    stock: z.number().int().min(0).optional(),
    condition: z.enum(['new', 'like_new', 'good', 'fair', 'poor']).default('new'),
    status: z.enum(['available', 'unavailable', 'sold']).default('available'),
    category_id: z.string().optional().nullable(),
  })

  const defaultValues = {
    name: initialData?.name || '',
    description: initialData?.description || '',
    base_price: initialData?.base_price || 0,
    selling_price: initialData?.selling_price || 0,
    negotiable: initialData?.negotiable || false,
    stock: initialData?.details?.stock || 0,
    condition: (initialData?.condition || 'new') as 'new' | 'like_new' | 'good' | 'fair' | 'poor',
    status: (initialData?.status || 'available') as 'available' | 'unavailable' | 'sold',
    category_id: initialData?.category_id || null,
  }

  const form = useForm<any>({
    defaultValues,
  })

  // Watch base_price and category_id, auto-calculate selling_price using pricing rules
  const basePrice = form.watch('base_price')
  const categoryId = form.watch('category_id')
  
  React.useEffect(() => {
    if (basePrice > 0 && categoryId) {
      // Get category name to calculate pricing
      const category = categories.find(c => c.id === categoryId)
      if (category) {
        // Import pricing calculation (client-side)
        import('@/lib/domain/pricing-rules').then(({ calculateSellingPrice }) => {
          const calculatedSellingPrice = calculateSellingPrice(category.name, basePrice)
          form.setValue('selling_price', calculatedSellingPrice)
        })
      }
    } else if (basePrice > 0) {
      // Fallback to default rule if no category selected
      import('@/lib/domain/pricing-rules').then(({ calculateSellingPrice }) => {
        const calculatedSellingPrice = calculateSellingPrice('default', basePrice)
        form.setValue('selling_price', calculatedSellingPrice)
      })
    }
  }, [basePrice, categoryId, categories, form])

  // Mutations
  const createMutation = useMutation({
    mutationFn: async (data: CreateProductInput) => {
      console.log('🔵 Mutation function called with:', data)
      // Server action will get seller_id from session, no need to pass it
      const result = await productService.createProduct(data)
      console.log('🔵 Product service returned:', result)
      return result
    },
    onSuccess: (result) => {
      console.log('✅ onSuccess called with result:', result)
      if (result.success) {
        console.log('🎉 Create mutation success:', result)
        toast.success('Product created successfully')
        queryClient.invalidateQueries({ queryKey: ['products'] })
        router.push('/products')
      } else {
        console.error('❌ Create failed with error:', result.error)
        toast.error(result.error || 'Failed to create product')
      }
    },
    onError: (error: any) => {
      console.error('❌ Create mutation error:', error)
      toast.error(error.message || 'Failed to create product')
    },
  })

  const updateMutation = useMutation({
    mutationFn: (data: UpdateProductInput) => productService.updateProduct(productId!, data),
    onSuccess: (result) => {
      if (result.success) {
        console.log('🎉 Update mutation success:', result)
        toast.success('Product updated successfully')
        queryClient.invalidateQueries({ queryKey: ['products'] })
        queryClient.invalidateQueries({ queryKey: ['product', productId] })
        router.push('/products')
      } else {
        toast.error(result.error || 'Failed to update product')
      }
    },
    onError: (error: any) => {
      console.error('❌ Update mutation error:', error)
      toast.error(error.message || 'Failed to update product')
    },
  })

  const onSubmit = (data: CreateProductInput | UpdateProductInput) => {
    console.log('📝 Form submit - Raw data:', data)
    console.log('🖼️ Form submit - Uploaded images:', uploadedImages)
    
    // Validation: Must have at least 1 image
    if (uploadedImages.length === 0) {
      toast.error('Minimal 1 gambar produk harus diupload')
      return
    }
    
    // Include uploaded images in the product data
    const productData = {
      ...data,
      main_image_url: uploadedImages.length > 0 ? uploadedImages[0].url : null,
      images: uploadedImages.map((img, index) => ({
        url: img.url,
        alt_text: `${data.name} image ${index + 1}`,
        is_primary: index === 0,
        sort_order: index,
      }))
    }

    console.log('🚀 Form submit - Final product data:', productData)

    if (mode === 'create') {
      console.log('🆕 Calling create mutation')
      createMutation.mutate(productData as CreateProductInput)
    } else {
      console.log('✏️ Calling update mutation')
      updateMutation.mutate(productData as UpdateProductInput)
    }
  }

  const isLoading = createMutation.isPending || updateMutation.isPending

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="flex items-center justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Kembali
          </Button>
          
          <div className="flex space-x-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push('/products')}
            >
              <X className="mr-2 h-4 w-4" />
              Batal
            </Button>
            <LoadingButton
              type="submit"
              loading={isLoading}
            >
              <Save className="mr-2 h-4 w-4" />
              {mode === 'create' ? 'Buat Produk' : 'Perbarui Produk'}
            </LoadingButton>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle>Informasi Dasar</CardTitle>
                <CardDescription>
                  Detail produk dan deskripsi penting
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nama Produk *</FormLabel>
                      <FormControl>
                        <Input placeholder="Masukkan nama produk" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="category_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Kategori</FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        defaultValue={field.value || undefined}
                        disabled={categoriesLoading}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue 
                              placeholder={categoriesLoading ? "Memuat kategori..." : "Pilih kategori"} 
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {categories.length === 0 && !categoriesLoading && (
                            <SelectItem value="" disabled>
                              Tidak ada kategori tersedia
                            </SelectItem>
                          )}
                          {categories.map((category) => (
                            <SelectItem key={category.id} value={category.id}>
                              {category.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Pilih kategori yang paling sesuai
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Deskripsi *</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Masukkan deskripsi produk lengkap"
                          rows={4}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="condition"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Kondisi *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Pilih kondisi" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="new">Baru</SelectItem>
                            <SelectItem value="like_new">Seperti Baru</SelectItem>
                            <SelectItem value="good">Baik</SelectItem>
                            <SelectItem value="fair">Cukup Baik</SelectItem>
                            <SelectItem value="poor">Kurang Baik</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="stock"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Jumlah Stok *</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="0"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Pricing */}
            <Card>
              <CardHeader>
                <CardTitle>Harga & Negosiasi</CardTitle>
                <CardDescription>
                  <strong>Harga ditentukan oleh sistem berdasarkan kategori dan aturan pricing.</strong>
                  <br />
                  Anda hanya perlu mengisi harga dasar, sistem akan menghitung harga jual dan range negosiasi secara otomatis.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="base_price"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Harga Dasar *</FormLabel>
                        <FormControl>
                          <Input
                            type="text"
                            placeholder="0"
                            {...field}
                            value={field.value?.toString() || ''}
                            onChange={(e) => {
                              const value = e.target.value.replace(/[^0-9]/g, '')
                              field.onChange(value ? parseInt(value) : 0)
                            }}
                          />
                        </FormControl>
                        <FormDescription>
                          Biaya atau harga minimal yang dapat diterima
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="selling_price"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Harga Jual (Dihitung Sistem) *</FormLabel>
                        <FormControl>
                          <Input
                            type="text"
                            placeholder="0"
                            {...field}
                            value={field.value?.toLocaleString('id-ID') || '0'}
                            disabled
                            className="bg-muted cursor-not-allowed"
                          />
                        </FormControl>
                        <FormDescription>
                          🔒 Harga ditentukan sistem berdasarkan kategori & pricing rules
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="negotiable"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">
                          Dapat Dinegosiasi
                        </FormLabel>
                        <FormDescription>
                          Izinkan pelanggan menawar harga
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>


          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Product Images - Moved to top of sidebar for better UX */}
            <Card>
              <CardHeader>
                <CardTitle>Foto Produk</CardTitle>
                <CardDescription>
                  Upload foto produk (maksimal 3 gambar). Gambar pertama akan menjadi foto utama.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ImageUpload
                  images={uploadedImages}
                  onImagesChange={setUploadedImages}
                  maxImages={10}
                />
                {uploadedImages.length === 0 && (
                  <p className="text-sm text-amber-600 mt-2 flex items-center gap-2">
                    <span>⚠️</span> Minimal 1 gambar produk diperlukan
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Status & Category */}
            <Card>
              <CardHeader>
                <CardTitle>Status & Kategori</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Pilih status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="available">Tersedia</SelectItem>
                          <SelectItem value="unavailable">Tidak Tersedia</SelectItem>
                          <SelectItem value="sold">Terjual</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />


              </CardContent>
            </Card>
          </div>
        </div>
      </form>
    </Form>
  )
}