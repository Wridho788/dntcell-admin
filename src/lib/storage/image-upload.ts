'use client'

import { supabase } from '@/lib/supabase/client'

// Image upload configuration
const STORAGE_BUCKET = 'product-images'
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg']
const COMPRESSION_QUALITY = 0.8

// Image compression utility
export const compressImage = async (file: File, quality: number = COMPRESSION_QUALITY): Promise<File> => {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const img = new Image()

    img.onload = () => {
      // Calculate new dimensions (max 1200px width/height)
      const maxSize = 1200
      let { width, height } = img
      
      if (width > height) {
        if (width > maxSize) {
          height = (height * maxSize) / width
          width = maxSize
        }
      } else {
        if (height > maxSize) {
          width = (width * maxSize) / height
          height = maxSize
        }
      }

      canvas.width = width
      canvas.height = height

      // Draw and compress
      ctx?.drawImage(img, 0, 0, width, height)
      
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Failed to compress image'))
            return
          }
          
          const compressedFile = new File([blob], file.name, {
            type: file.type,
            lastModified: Date.now(),
          })
          
          resolve(compressedFile)
        },
        file.type,
        quality
      )
    }

    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = URL.createObjectURL(file)
  })
}

// Validate image file
export const validateImageFile = (file: File): { valid: boolean; error?: string } => {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: `File type ${file.type} is not allowed. Please use JPEG, PNG, or WebP.`,
    }
  }

  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File size ${(file.size / 1024 / 1024).toFixed(1)}MB exceeds the maximum size of ${MAX_FILE_SIZE / 1024 / 1024}MB.`,
    }
  }

  return { valid: true }
}

// Generate unique filename
export const generateFileName = (originalName: string, productId?: string): string => {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 15)
  const extension = originalName.split('.').pop()?.toLowerCase() || 'jpg'
  
  if (productId) {
    return `${productId}/${timestamp}-${random}.${extension}`
  }
  
  return `temp/${timestamp}-${random}.${extension}`
}

// Upload image to Supabase Storage (client-side)
export const uploadImageClient = async (
  file: File,
  options: {
    productId?: string
    compress?: boolean
    onProgress?: (progress: number) => void
  } = {}
): Promise<{ url: string; path: string }> => {
  const { productId, compress = true, onProgress } = options

  // Validate file
  const validation = validateImageFile(file)
  if (!validation.valid) {
    throw new Error(validation.error)
  }

  // Compress image if needed
  let processedFile = file
  if (compress) {
    try {
      processedFile = await compressImage(file)
      onProgress?.(25)
    } catch (error) {
      console.warn('Image compression failed, using original file:', error)
    }
  }

  // Generate filename
  const fileName = generateFileName(file.name, productId)
  
  onProgress?.(50)

  // Upload to Supabase Storage
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(fileName, processedFile, {
      cacheControl: '3600',
      upsert: false,
    })

  if (error) {
    console.error('Upload error:', error)
    throw new Error(`Upload failed: ${error.message}`)
  }

  onProgress?.(75)

  // Get public URL
  const { data: urlData } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(data.path)

  onProgress?.(100)

  return {
    url: urlData.publicUrl,
    path: data.path,
  }
}

// Delete image from storage (client-side)
export const deleteImageClient = async (path: string): Promise<void> => {
  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .remove([path])

  if (error) {
    throw new Error(`Delete failed: ${error.message}`)
  }
}

// Upload multiple images
export const uploadMultipleImages = async (
  files: File[],
  options: {
    productId?: string
    onProgress?: (fileIndex: number, progress: number) => void
  } = {}
): Promise<Array<{ url: string; path: string; file: File }>> => {
  const results = []
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    
    try {
      const result = await uploadImageClient(file, {
        ...options,
        onProgress: (progress) => options.onProgress?.(i, progress),
      })
      
      results.push({ ...result, file })
    } catch (error) {
      console.error(`Failed to upload ${file.name}:`, error)
      throw error
    }
  }
  
  return results
}

// Server-side utilities (for use in Server Actions)
export const createStorageConfig = () => {
  return {
    bucket: STORAGE_BUCKET,
    maxSize: MAX_FILE_SIZE,
    allowedTypes: ALLOWED_TYPES,
  }
}

// Get public URL for a storage path
export const getPublicUrl = (path: string): string => {
  const { data } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(path)
  
  return data.publicUrl
}

