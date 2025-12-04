import { createClient } from '@/lib/supabase/client'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Move uploaded images from temp folder to product folder
 * This should be called after product is created
 */
export async function moveImagesToProduct(
  imageUrls: string[],
  productId: string,
  supabaseClient?: SupabaseClient
): Promise<string[]> {
  const supabase = supabaseClient || createClient()
  const movedUrls: string[] = []

  for (const url of imageUrls) {
    try {
      // Extract file path from URL
      const urlObj = new URL(url)
      const pathParts = urlObj.pathname.split('/')
      const bucketIndex = pathParts.findIndex(part => part === 'product-images')
      
      if (bucketIndex === -1) {
        console.error('Invalid image URL:', url)
        movedUrls.push(url) // Keep original URL if invalid
        continue
      }

      const oldPath = pathParts.slice(bucketIndex + 1).join('/')
      
      // Only move if it's in temp folder
      if (!oldPath.startsWith('temp/')) {
        movedUrls.push(url) // Already in correct location
        continue
      }

      const fileName = oldPath.replace('temp/', '')
      const newPath = `${productId}/${fileName}`

      console.log('Moving image:', { oldPath, newPath })

      // Download from old location using proper download method
      const { data: fileData, error: downloadError } = await supabase.storage
        .from('product-images')
        .download(oldPath) // Supabase will handle the path correctly

      if (downloadError) {
        console.error('Error downloading image:', downloadError)
        movedUrls.push(url) // Keep original URL on error
        continue
      }

      // Upload to new location
      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(newPath, fileData, {
          cacheControl: '3600',
          upsert: false
        })

      if (uploadError) {
        console.error('Error uploading to new location:', uploadError)
        movedUrls.push(url) // Keep original URL on error
        continue
      }

      // Delete from old location
      const { error: deleteError } = await supabase.storage
        .from('product-images')
        .remove([oldPath])

      if (deleteError) {
        console.warn('Error deleting old image:', deleteError)
        // Don't fail if delete fails, we still have the new location
      }

      // Get new public URL from the NEW location (not temp)
      const { data: urlData } = supabase.storage
        .from('product-images')
        .getPublicUrl(newPath) // Use newPath, not oldPath

      movedUrls.push(urlData.publicUrl)
      console.log('✅ Image moved successfully:', newPath, '→', urlData.publicUrl)
    } catch (error) {
      console.error('Error moving image:', error)
      movedUrls.push(url) // Keep original URL on error
    }
  }

  return movedUrls
}

/**
 * Delete images from storage
 */
export async function deleteProductImages(
  imageUrls: string[],
  supabaseClient?: SupabaseClient
): Promise<void> {
  const supabase = supabaseClient || createClient()
  const paths: string[] = []

  for (const url of imageUrls) {
    try {
      // Extract file path from URL
      const urlObj = new URL(url)
      const pathParts = urlObj.pathname.split('/')
      const bucketIndex = pathParts.findIndex(part => part === 'product-images')
      
      if (bucketIndex !== -1) {
        const path = pathParts.slice(bucketIndex + 1).join('/')
        paths.push(path)
      }
    } catch (error) {
      console.error('Error parsing image URL:', url, error)
    }
  }

  if (paths.length > 0) {
    const { error } = await supabase.storage
      .from('product-images')
      .remove(paths)

    if (error) {
      console.error('Error deleting images:', error)
      throw error
    }

    console.log('✅ Deleted images:', paths)
  }
}
