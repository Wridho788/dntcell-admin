import { createAdminSupabaseClient } from '@/lib/supabase/server'

// Image upload configuration
const STORAGE_BUCKET = 'product-images'
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg']

// Server-side storage configuration
export const createStorageConfig = () => {
  return {
    bucket: STORAGE_BUCKET,
    maxSize: MAX_FILE_SIZE,
    allowedTypes: ALLOWED_TYPES,
  }
}

// Create storage bucket (run once during setup)
export const createStorageBucket = async (): Promise<void> => {
  try {
    const adminClient = createAdminSupabaseClient()
    
    // Create bucket if it doesn't exist
    const { error } = await adminClient.storage.createBucket(STORAGE_BUCKET, {
      public: true,
      allowedMimeTypes: ALLOWED_TYPES,
      fileSizeLimit: MAX_FILE_SIZE,
    })
    
    if (error && !error.message.includes('already exists')) {
      throw error
    }
    
    console.log('Storage bucket created/verified successfully')
  } catch (error) {
    console.error('Failed to create storage bucket:', error)
  }
}

// Delete image from storage (server-side with admin client)
export const deleteImageServer = async (path: string): Promise<void> => {
  const adminClient = createAdminSupabaseClient()
  
  const { error } = await adminClient.storage
    .from(STORAGE_BUCKET)
    .remove([path])

  if (error) {
    throw new Error(`Delete failed: ${error.message}`)
  }
}

// Move image from temp to permanent location (server-side)
export const moveImageToPermanent = async (
  tempPath: string,
  productId: string,
  originalName: string
): Promise<{ url: string; path: string }> => {
  const adminClient = createAdminSupabaseClient()
  
  // Generate new path
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 15)
  const extension = originalName.split('.').pop()?.toLowerCase() || 'jpg'
  const newPath = `${productId}/${timestamp}-${random}.${extension}`
  
  // Move file from temp to permanent location
  const { error: moveError } = await adminClient.storage
    .from(STORAGE_BUCKET)
    .move(tempPath, newPath)
  
  if (moveError) {
    throw new Error(`Failed to move image: ${moveError.message}`)
  }
  
  // Get public URL
  const { data: urlData } = adminClient.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(newPath)
  
  return {
    url: urlData.publicUrl,
    path: newPath,
  }
}

// Cleanup temp files older than 24 hours (server-side)
export const cleanupTempFiles = async (): Promise<void> => {
  const adminClient = createAdminSupabaseClient()
  
  try {
    const { data: files, error } = await adminClient.storage
      .from(STORAGE_BUCKET)
      .list('temp', {
        limit: 100,
        sortBy: { column: 'created_at', order: 'asc' }
      })
    
    if (error) throw error
    
    const cutoff = Date.now() - 24 * 60 * 60 * 1000 // 24 hours ago
    const filesToDelete = files
      ?.filter(file => new Date(file.created_at).getTime() < cutoff)
      ?.map(file => `temp/${file.name}`) || []
    
    if (filesToDelete.length > 0) {
      const { error: deleteError } = await adminClient.storage
        .from(STORAGE_BUCKET)
        .remove(filesToDelete)
      
      if (deleteError) {
        console.error('Failed to cleanup temp files:', deleteError)
      } else {
        console.log(`Cleaned up ${filesToDelete.length} temp files`)
      }
    }
  } catch (error) {
    console.error('Error during temp file cleanup:', error)
  }
}