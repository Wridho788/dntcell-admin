export * from './image-upload'
export * from './image-operations'

// Storage configuration
export const STORAGE_CONFIG = {
  PRODUCT_IMAGES_BUCKET: 'product-images',
  MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'],
  COMPRESSION_QUALITY: 0.8,
  MAX_IMAGE_DIMENSIONS: 1200,
} as const