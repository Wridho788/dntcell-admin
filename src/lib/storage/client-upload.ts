import { createClient } from '@/lib/supabase/client'
import { validateImageFile, compressImage } from './image-upload'

// Client-side upload
export async function uploadImageClient(
  file: File, 
  bucket: string = 'products'
): Promise<{ success: boolean; data?: { publicUrl: string }; error?: string }> {
  try {
    const supabase = createClient()
    
    // Validate file
    const validation = validateImageFile(file)
    if (!validation.valid) {
      return { success: false, error: validation.error }
    }

    // Compress image
    const compressedFile = await compressImage(file, 0.8)
    
    // Generate unique filename
    const fileExt = file.name.split('.').pop()
    const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`
    const filePath = `${bucket}/${fileName}`

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('product-images')
      .upload(filePath, compressedFile, {
        cacheControl: '3600',
        upsert: false
      })

    if (error) {
      console.error('Upload error:', error)
      return { success: false, error: error.message }
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('product-images')
      .getPublicUrl(filePath)

    return {
      success: true,
      data: { publicUrl }
    }
  } catch (error) {
    console.error('Upload error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

// Delete image (client-side)
export async function deleteImageClient(filePath: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createClient()
    
    const { error } = await supabase.storage
      .from('product-images')
      .remove([filePath])

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}