'use client'

import { createClient } from '@/lib/supabase/client'

export interface ImageUploadOptions {
  bucket?: string
  folder?: string
  maxSize?: number // in bytes
  allowedTypes?: string[]
  quality?: number // 0-1 for image compression
}

export interface UploadResult {
  success: boolean
  data?: {
    url: string
    path: string
    size: number
    type: string
  }
  error?: string
}

export interface ImageMetadata {
  id?: string
  product_id?: string
  url: string
  alt_text?: string
  is_primary: boolean
  sort_order: number
  created_at?: string
}

export class ImageService {
  private supabase = createClient()
  private defaultBucket = 'product-images'
  private defaultOptions: ImageUploadOptions = {
    bucket: this.defaultBucket,
    folder: 'products',
    maxSize: 5 * 1024 * 1024, // 5MB
    allowedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
    quality: 0.8
  }

  // Upload single image
  async uploadImage(file: File, options: ImageUploadOptions = {}): Promise<UploadResult> {
    try {
      const opts = { ...this.defaultOptions, ...options }

      // Validate file
      const validation = this.validateFile(file, opts)
      if (!validation.valid) {
        return { success: false, error: validation.error }
      }

      // Generate unique filename
      const fileExt = file.name.split('.').pop()?.toLowerCase()
      const fileName = `${opts.folder}/${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`

      // Compress image if needed
      let processedFile = file
      if (file.type.startsWith('image/') && opts.quality && opts.quality < 1) {
        processedFile = await this.compressImage(file, opts.quality)
      }

      // Upload to Supabase Storage
      const { data, error } = await this.supabase.storage
        .from(opts.bucket!)
        .upload(fileName, processedFile, {
          cacheControl: '3600',
          upsert: false
        })

      if (error) {
        console.error('Error uploading image:', error)
        return { success: false, error: error.message }
      }

      // Get public URL
      const { data: urlData } = this.supabase.storage
        .from(opts.bucket!)
        .getPublicUrl(data.path)

      return {
        success: true,
        data: {
          url: urlData.publicUrl,
          path: data.path,
          size: processedFile.size,
          type: processedFile.type
        }
      }
    } catch (error) {
      console.error('ImageService.uploadImage error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }
    }
  }

  // Upload multiple images
  async uploadMultipleImages(files: File[], options: ImageUploadOptions = {}): Promise<{
    success: boolean
    data?: Array<{ url: string; path: string; size: number; type: string }>
    errors?: Array<{ file: string; error: string }>
  }> {
    try {
      const results = await Promise.allSettled(
        files.map(file => this.uploadImage(file, options))
      )

      const successfulUploads: Array<{ url: string; path: string; size: number; type: string }> = []
      const errors: Array<{ file: string; error: string }> = []

      results.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value.success && result.value.data) {
          successfulUploads.push(result.value.data)
        } else {
          const error = result.status === 'fulfilled' 
            ? result.value.error || 'Unknown error'
            : result.reason.message || 'Upload failed'
          errors.push({ file: files[index].name, error })
        }
      })

      return {
        success: successfulUploads.length > 0,
        data: successfulUploads,
        errors: errors.length > 0 ? errors : undefined
      }
    } catch (error) {
      console.error('ImageService.uploadMultipleImages error:', error)
      return {
        success: false,
        errors: [{ file: 'batch', error: error instanceof Error ? error.message : 'Batch upload failed' }]
      }
    }
  }

  // Delete image from storage
  async deleteImage(path: string, bucket: string = this.defaultBucket): Promise<{ success: boolean; error?: string }> {
    try {
      if (!path) {
        return { success: false, error: 'Image path is required' }
      }

      const { error } = await this.supabase.storage
        .from(bucket)
        .remove([path])

      if (error) {
        console.error('Error deleting image:', error)
        return { success: false, error: error.message }
      }

      return { success: true }
    } catch (error) {
      console.error('ImageService.deleteImage error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }
    }
  }

  // Delete multiple images from storage
  async deleteMultipleImages(paths: string[], bucket: string = this.defaultBucket): Promise<{
    success: boolean
    deletedCount?: number
    errors?: Array<{ path: string; error: string }>
  }> {
    try {
      if (!paths.length) {
        return { success: false, errors: [{ path: 'batch', error: 'No paths provided' }] }
      }

      const { data, error } = await this.supabase.storage
        .from(bucket)
        .remove(paths)

      if (error) {
        console.error('Error deleting multiple images:', error)
        return { success: false, errors: [{ path: 'batch', error: error.message }] }
      }

      return {
        success: true,
        deletedCount: data?.length || 0
      }
    } catch (error) {
      console.error('ImageService.deleteMultipleImages error:', error)
      return {
        success: false,
        errors: [{ path: 'batch', error: error instanceof Error ? error.message : 'Batch delete failed' }]
      }
    }
  }

  // Get image metadata from database
  async getProductImages(productId: string): Promise<{ success: boolean; data?: ImageMetadata[]; error?: string }> {
    try {
      if (!productId) {
        return { success: false, error: 'Product ID is required' }
      }

      const { data, error } = await this.supabase
        .from('product_images')
        .select('*')
        .eq('product_id', productId)
        .order('sort_order', { ascending: true })

      if (error) {
        console.error('Error fetching product images:', error)
        // If product_images table doesn't exist, return empty array
        if (error.code === '42P01' || error.message.includes('relation') || error.message.includes('does not exist')) {
          return { success: true, data: [] }
        }
        return { success: false, error: error.message }
      }

      // Check if data is valid before using
      if (!Array.isArray(data)) {
        console.warn('Invalid data structure from product_images table, returning empty array')
        return { success: true, data: [] }
      }

      return { success: true, data: data as unknown as ImageMetadata[] }
    } catch (error) {
      console.error('ImageService.getProductImages error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }
    }
  }

  // Save image metadata to database
  async saveImageMetadata(metadata: ImageMetadata): Promise<{ success: boolean; data?: ImageMetadata; error?: string }> {
    try {
      const { data, error } = await this.supabase
        .from('product_images')
        .insert({
          ...metadata,
          created_at: new Date().toISOString()
        })
        .select()
        .single()

      if (error) {
        console.error('Error saving image metadata:', error)
        if (error.code === '42P01' || error.message.includes('relation') || error.message.includes('does not exist')) {
          return { success: false, error: 'Image metadata storage not configured' }
        }
        return { success: false, error: error.message }
      }

      return { success: true, data: data as unknown as ImageMetadata }
    } catch (error) {
      console.error('ImageService.saveImageMetadata error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }
    }
  }

  // Update image metadata
  async updateImageMetadata(id: string, updates: Partial<ImageMetadata>): Promise<{ success: boolean; data?: ImageMetadata; error?: string }> {
    try {
      if (!id) {
        return { success: false, error: 'Image ID is required' }
      }

      const { data, error } = await this.supabase
        .from('product_images')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) {
        console.error('Error updating image metadata:', error)
        if (error.code === '42P01' || error.message.includes('relation') || error.message.includes('does not exist')) {
          return { success: false, error: 'Image metadata storage not configured' }
        }
        return { success: false, error: error.message }
      }

      return { success: true, data: data as unknown as ImageMetadata }
    } catch (error) {
      console.error('ImageService.updateImageMetadata error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }
    }
  }

  // Delete image metadata from database
  async deleteImageMetadata(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (!id) {
        return { success: false, error: 'Image ID is required' }
      }

      const { error } = await this.supabase
        .from('product_images')
        .delete()
        .eq('id', id)

      if (error) {
        console.error('Error deleting image metadata:', error)
        if (error.code === '42P01' || error.message.includes('relation') || error.message.includes('does not exist')) {
          return { success: false, error: 'Image metadata storage not configured' }
        }
        return { success: false, error: error.message }
      }

      return { success: true }
    } catch (error) {
      console.error('ImageService.deleteImageMetadata error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }
    }
  }

  // Validate file
  private validateFile(file: File, options: ImageUploadOptions): { valid: boolean; error?: string } {
    // Check file size
    if (options.maxSize && file.size > options.maxSize) {
      const maxSizeMB = Math.round(options.maxSize / 1024 / 1024)
      return { valid: false, error: `File size must be less than ${maxSizeMB}MB` }
    }

    // Check file type
    if (options.allowedTypes && !options.allowedTypes.includes(file.type)) {
      return { 
        valid: false, 
        error: `File type not allowed. Allowed types: ${options.allowedTypes.join(', ')}` 
      }
    }

    return { valid: true }
  }

  // Compress image (basic implementation)
  private compressImage(file: File, quality: number): Promise<File> {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      const img = new Image()

      img.onload = () => {
        // Set canvas dimensions
        canvas.width = img.width
        canvas.height = img.height

        // Draw and compress
        ctx?.drawImage(img, 0, 0)
        
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name, {
                type: file.type,
                lastModified: Date.now()
              })
              resolve(compressedFile)
            } else {
              reject(new Error('Failed to compress image'))
            }
          },
          file.type,
          quality
        )
      }

      img.onerror = () => reject(new Error('Failed to load image for compression'))
      img.src = URL.createObjectURL(file)
    })
  }

  // Get storage usage
  async getStorageUsage(bucket: string = this.defaultBucket): Promise<{ success: boolean; data?: { totalSize: number; fileCount: number }; error?: string }> {
    try {
      const { data, error } = await this.supabase.storage
        .from(bucket)
        .list('', {
          limit: 1000,
          sortBy: { column: 'created_at', order: 'desc' }
        })

      if (error) {
        console.error('Error getting storage usage:', error)
        return { success: false, error: error.message }
      }

      const totalSize = data?.reduce((sum, file) => sum + (file.metadata?.size || 0), 0) || 0
      const fileCount = data?.length || 0

      return {
        success: true,
        data: { totalSize, fileCount }
      }
    } catch (error) {
      console.error('ImageService.getStorageUsage error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }
    }
  }
}

// Export singleton instance
export const imageService = new ImageService()
export default ImageService