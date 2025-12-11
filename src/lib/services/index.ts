// Legacy services (to be deprecated)
export { ProductService, productService } from './ProductService'
export { CategoryService, categoryService } from './CategoryService'
export { ImageService, imageService } from './ImageService'

export type {
  DbProduct,
  ProductFilters,
  ProductsResponse,
} from './ProductService'

export type {
  DbCategory,
  CreateCategoryInput,
  UpdateCategoryInput,
} from './CategoryService'

export type {
  ImageUploadOptions,
  UploadResult,
  ImageMetadata,
} from './ImageService'

// New API-based services
export * from './productImageService'
export * from './negotiationService'
export * from './orderService'
export * from './notificationService'
export * from './userService'
export * from './activityLogService'