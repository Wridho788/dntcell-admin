# REST API Implementation - Complete Documentation

## Overview

This document provides comprehensive documentation for the complete REST API migration implemented in the dntcell-admin project.

## Architecture

### Core Modules

Located in `src/api/_core/`:

1. **supabase-server.ts** - Admin Supabase client with service role
   - `supabaseAdmin`: Bypasses RLS for admin operations
   - `getUserFromAuth(request)`: Validates JWT and returns user
   - `isUserAdmin(userId)`: Checks if user has admin role

2. **response.ts** - Standardized API responses
   - `successResponse(data, message, status)`
   - `errorResponse(message, status)`
   - `unauthorizedResponse(message)`
   - `forbiddenResponse(message)`
   - `notFoundResponse(message)`
   - `validationErrorResponse(errors)`
   - `serverErrorResponse(message)`

3. **auth.ts** - Authentication middleware
   - `requireAuth(request)`: Validates any authenticated user
   - `requireAdmin(request)`: Validates admin user only
   - Returns: `{ userId, isAdmin }` or error response

4. **validator.ts** - Request validation
   - `validatePayload(data, schema)`: Validates with Zod
   - `parseRequestBody(request, schema)`: Parses and validates request body

5. **error.ts** - Error handling
   - `ApiError`: Custom error class
   - `handleApiError(error, context)`: Centralized error handler

6. **activity-logger.ts** - Admin action logging
   - `logActivity({ admin_id, action, meta })`: Logs to activity_logs table

### Standard Response Format

```typescript
interface ApiResponse<T> {
  success: boolean
  data?: T
  message?: string
  error?: string
}
```

## API Endpoints

### Products

**Base Path:** `/api/products`

#### GET /api/products
List products with filters

**Query Parameters:**
- `category_id` (string, optional)
- `seller_id` (string, optional)
- `status` (string, optional): pending | approved | rejected
- `is_active` (boolean, optional)
- `page` (number, optional)
- `limit` (number, optional)

**Response:**
```json
{
  "success": true,
  "data": [{
    "id": "uuid",
    "name": "string",
    "description": "string",
    "category_id": "uuid",
    "seller_id": "uuid",
    "base_price": 0,
    "is_negotiable": true,
    "status": "approved",
    "is_active": true,
    "created_at": "timestamp",
    "updated_at": "timestamp",
    "category": { "id": "uuid", "name": "string" },
    "seller": { "id": "uuid", "full_name": "string", "phone": "string" },
    "images": [{ "id": "uuid", "image_url": "string", "is_main": true }]
  }]
}
```

#### POST /api/products
Create new product (authenticated users)

**Request Body:**
```json
{
  "name": "string",
  "description": "string",
  "category_id": "uuid",
  "base_price": 0,
  "is_negotiable": true,
  "images": [
    {
      "image_url": "string",
      "display_order": 0,
      "is_main": true
    }
  ]
}
```

#### GET /api/products/[id]
Get single product detail

#### PUT /api/products/[id]
Update product (owner or admin)

**Request Body:** (all fields optional)
```json
{
  "name": "string",
  "description": "string",
  "category_id": "uuid",
  "base_price": 0,
  "is_negotiable": true,
  "status": "approved",
  "is_active": true,
  "rejection_reason": "string"
}
```

#### DELETE /api/products/[id]
Soft delete product (owner or admin)

---

### Product Images

**Base Path:** `/api/product-images`

#### GET /api/product-images
List images for a product

**Query Parameters:**
- `product_id` (string, required)

#### POST /api/product-images
Upload new product image (owner or admin)

**Request Body:**
```json
{
  "product_id": "uuid",
  "image_url": "string",
  "display_order": 0,
  "is_main": false
}
```

**Note:** Setting `is_main: true` will automatically unset other main images for the product.

#### GET /api/product-images/[id]
Get single product image

#### PATCH /api/product-images/[id]
Update product image (owner or admin)

**Request Body:**
```json
{
  "display_order": 0,
  "is_main": true
}
```

#### DELETE /api/product-images/[id]
Delete product image (owner or admin)

---

### Categories

**Base Path:** `/api/categories`

#### GET /api/categories
List all categories (public access)

**Response:**
```json
{
  "success": true,
  "data": [{
    "id": "uuid",
    "name": "string",
    "description": "string",
    "created_at": "timestamp",
    "updated_at": "timestamp"
  }]
}
```

#### POST /api/categories
Create new category (admin only)

**Request Body:**
```json
{
  "name": "string",
  "description": "string"
}
```

#### GET /api/categories/[id]
Get single category (public access)

#### PATCH /api/categories/[id]
Update category (admin only)

**Request Body:**
```json
{
  "name": "string",
  "description": "string"
}
```

#### DELETE /api/categories/[id]
Delete category (admin only)

---

### Negotiations

**Base Path:** `/api/negotiations`

#### GET /api/negotiations
List negotiations (role-based access)

**Query Parameters:**
- `product_id` (string, optional)
- `buyer_id` (string, optional)
- `status` (string, optional): pending | approved | rejected
- `is_used` (boolean, optional)
- `page` (number, optional)
- `limit` (number, optional)

**Access Control:**
- Regular users: Only see their own negotiations
- Admins: See all negotiations

#### POST /api/negotiations
Create new negotiation

**Request Body:**
```json
{
  "product_id": "uuid",
  "offered_price": 0,
  "buyer_note": "string"
}
```

**Validation:**
- Product must be active
- Product must be negotiable
- Offered price must be positive

#### POST /api/negotiations/[id]/approve
Approve negotiation (admin only)

**Request Body:**
```json
{
  "final_price": 0,
  "admin_note": "string"
}
```

**Side Effects:**
- Creates notification for buyer
- Logs admin activity

#### POST /api/negotiations/[id]/reject
Reject negotiation (admin only)

**Request Body:**
```json
{
  "admin_note": "string"
}
```

---

### Orders

**Base Path:** `/api/orders`

#### GET /api/orders
List orders (role-based access)

**Query Parameters:**
- `product_id` (string, optional)
- `buyer_id` (string, optional)
- `seller_id` (string, optional)
- `status` (string, optional): pending | processing | completed | cancelled
- `page` (number, optional)
- `limit` (number, optional)

**Access Control:**
- Regular users: See orders as buyer or seller
- Admins: See all orders

#### POST /api/orders
Create new order

**Request Body:**
```json
{
  "product_id": "uuid",
  "negotiation_id": "uuid",
  "final_price": 0
}
```

**Validation:**
- If `negotiation_id` provided:
  - Must be approved
  - Must not be used already
  - Marks negotiation as used

#### PUT /api/orders/[id]/status
Update order status (admin only)

**Request Body:**
```json
{
  "status": "processing",
  "admin_note": "string"
}
```

**Side Effects:**
- Creates notification for buyer
- Logs admin activity

---

### Notifications

**Base Path:** `/api/notifications`

#### GET /api/notifications
List user notifications

**Query Parameters:**
- `is_read` (boolean, optional)
- `type` (string, optional): info | success | warning | error
- `page` (number, optional)
- `limit` (number, optional)

**Access Control:** Users see only their own notifications

#### POST /api/notifications
Send notification (admin only)

**Request Body:**
```json
{
  "user_id": "uuid",
  "title": "string",
  "message": "string",
  "type": "info",
  "meta": {}
}
```

---

### Users

**Base Path:** `/api/users`

#### GET /api/users
List all users (admin only)

**Query Parameters:**
- `role` (string, optional): user | admin
- `page` (number, optional)
- `limit` (number, optional)

#### GET /api/users/me
Get current user profile

**Response:**
```json
{
  "success": true,
  "data": {
    "profile": {
      "id": "uuid",
      "email": "string",
      "full_name": "string",
      "phone": "string",
      "role": "user",
      "created_at": "timestamp"
    },
    "isAdmin": false
  }
}
```

---

### Activity Logs

**Base Path:** `/api/activity`

#### GET /api/activity
List activity logs (admin only)

**Query Parameters:**
- `admin_id` (string, optional)
- `action` (string, optional)
- `page` (number, optional)
- `limit` (number, optional)

**Response:**
```json
{
  "success": true,
  "data": [{
    "id": "uuid",
    "admin_id": "uuid",
    "action": "string",
    "meta": {},
    "created_at": "timestamp",
    "admin": {
      "id": "uuid",
      "full_name": "string",
      "email": "string"
    }
  }]
}
```

---

## Service Layer

Located in `src/lib/services/`:

### API Client

`api-client.ts` provides the base HTTP client:

```typescript
import { api } from '@/lib/api-client';

// Generic methods
api.get<T>(endpoint, params?)
api.post<T>(endpoint, data?)
api.put<T>(endpoint, data?)
api.patch<T>(endpoint, data?)
api.delete<T>(endpoint)
```

### Service Modules

Each entity has a dedicated service module:

- `productImageService.ts` - Product images operations
- `negotiationService.ts` - Negotiations operations
- `orderService.ts` - Orders operations
- `notificationService.ts` - Notifications operations
- `userService.ts` - Users operations
- `activityLogService.ts` - Activity logs operations

**Example Usage:**
```typescript
import { negotiationService } from '@/lib/services';

// Create negotiation
const response = await negotiationService.createNegotiation({
  product_id: 'uuid',
  offered_price: 5000,
  buyer_note: 'Can you lower the price?'
});

if (response.success) {
  console.log(response.data);
}
```

---

## React Query Hooks

Located in `src/hooks/`:

### Product Images

```typescript
import { 
  useProductImages, 
  useCreateProductImage, 
  useUpdateProductImage, 
  useDeleteProductImage 
} from '@/hooks/useProductImages';

// List images for a product
const { data: images, isLoading } = useProductImages(productId);

// Create image
const createMutation = useCreateProductImage({
  onSuccess: () => {
    // Handle success
  }
});

createMutation.mutate({
  product_id: 'uuid',
  image_url: 'https://...',
  is_main: true
});
```

### Negotiations

```typescript
import { 
  useNegotiations, 
  useCreateNegotiation, 
  useApproveNegotiation, 
  useRejectNegotiation 
} from '@/hooks/useNegotiations';

// List negotiations
const { data, isLoading } = useNegotiations({ status: 'pending' });

// Approve negotiation (admin)
const approveMutation = useApproveNegotiation();
approveMutation.mutate({
  id: 'negotiation-id',
  payload: {
    final_price: 5000,
    admin_note: 'Approved'
  }
});
```

### Orders

```typescript
import { 
  useOrders, 
  useCreateOrder, 
  useUpdateOrderStatus 
} from '@/hooks/useOrders';

// List orders
const { data, isLoading } = useOrders({ status: 'pending' });

// Create order
const createMutation = useCreateOrder();
createMutation.mutate({
  product_id: 'uuid',
  negotiation_id: 'uuid',
  final_price: 5000
});
```

### Notifications

```typescript
import { 
  useNotifications, 
  useSendNotification 
} from '@/hooks/useNotifications';

// List notifications
const { data, isLoading } = useNotifications({ is_read: false });

// Send notification (admin)
const sendMutation = useSendNotification();
sendMutation.mutate({
  user_id: 'uuid',
  title: 'Order Status Updated',
  message: 'Your order has been processed',
  type: 'success'
});
```

### Users

```typescript
import { 
  useUsers, 
  useCurrentUser 
} from '@/hooks/useUsers';

// List users (admin)
const { data: users } = useUsers();

// Current user profile
const { data: currentUser } = useCurrentUser();
```

### Activity Logs

```typescript
import { useActivityLogs } from '@/hooks/useActivityLogs';

// List activity logs (admin)
const { data, isLoading } = useActivityLogs({
  action: 'approve_negotiation'
});
```

---

## Authentication

All API endpoints use JWT authentication via the `Authorization` header:

```
Authorization: Bearer <access_token>
```

The token is automatically injected by the API client from the Supabase session.

### Access Levels

1. **Public** - No authentication required
   - GET /api/categories
   - GET /api/categories/[id]

2. **Authenticated** - Any logged-in user
   - Most GET endpoints (with role-based filtering)
   - POST /api/products
   - POST /api/negotiations
   - POST /api/orders

3. **Admin Only** - Requires admin role
   - POST /api/categories
   - PATCH /api/categories/[id]
   - DELETE /api/categories/[id]
   - POST /api/negotiations/[id]/approve
   - POST /api/negotiations/[id]/reject
   - PUT /api/orders/[id]/status
   - POST /api/notifications
   - GET /api/users
   - GET /api/activity

4. **Owner or Admin** - Resource owner or admin
   - PUT /api/products/[id]
   - DELETE /api/products/[id]
   - POST /api/product-images
   - PATCH /api/product-images/[id]
   - DELETE /api/product-images/[id]

---

## Error Handling

All endpoints return consistent error responses:

```json
{
  "success": false,
  "error": "Error message here"
}
```

### HTTP Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request / Validation Error
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `500` - Internal Server Error

---

## Activity Logging

All admin actions are automatically logged to the `activity_logs` table:

**Logged Actions:**
- create_product
- update_product
- delete_product
- create_product_image
- update_product_image
- delete_product_image
- create_category
- update_category
- delete_category
- approve_negotiation
- reject_negotiation
- update_order_status

**Log Entry Structure:**
```json
{
  "id": "uuid",
  "admin_id": "uuid",
  "action": "string",
  "meta": {
    // Context-specific data
  },
  "created_at": "timestamp"
}
```

---

## Database Migrations

### Foreign Keys Migration

**File:** `supabase/migrations/20251211_add_foreign_keys.sql`

Adds foreign key constraints for all table relationships:
- negotiations → products, profiles
- products → categories, profiles
- product_images → products
- orders → products, negotiations, profiles
- notifications → profiles
- profiles → auth.users
- activity_logs → profiles

**Important:** Includes `NOTIFY pgrst, 'reload schema'` to refresh PostgREST schema cache.

### OneSignal Player ID Migration

**File:** `supabase/migrations/20251210_add_onesignal_player_id.sql`

Adds `onesignal_player_id` column to profiles table for push notifications.

---

## Testing

### Manual Testing with Thunder Client / Postman

1. **Get access token** from Supabase session
2. **Set Authorization header:** `Bearer <token>`
3. **Test each endpoint** with various payloads
4. **Verify** response format and status codes

### Automated Testing

```bash
# Run build to check TypeScript errors
pnpm build

# Check for linting errors
pnpm lint
```

---

## Next Steps

1. **Deploy Database Migrations**
   ```sql
   -- In Supabase SQL Editor
   \i supabase/migrations/20251211_add_foreign_keys.sql
   \i supabase/migrations/20251210_add_onesignal_player_id.sql
   ```

2. **Frontend Migration**
   - Replace direct Supabase queries with service layer calls
   - Update components to use React Query hooks
   - Test each module after refactor

3. **API Documentation in Swagger**
   - Consider adding Swagger/OpenAPI documentation
   - Generate interactive API docs

4. **Rate Limiting**
   - Implement rate limiting for API endpoints
   - Prevent abuse and ensure fair usage

5. **Caching**
   - Implement Redis caching for frequently accessed data
   - Reduce database load

6. **Monitoring**
   - Add API logging and monitoring
   - Track performance metrics
   - Set up alerts for errors

---

## Known Issues

### PostgREST Schema Cache

After adding foreign keys, PostgREST may not recognize relationships until schema cache is refreshed.

**Solution:** The migration includes `NOTIFY pgrst, 'reload schema'` command.

**Manual Refresh:**
```sql
NOTIFY pgrst, 'reload schema';
```

**Documentation:** See `KNOWN-ISSUES.md` for details.

---

## Support

For questions or issues:
1. Check this documentation
2. Review `REST-API-MIGRATION.md`
3. Check `KNOWN-ISSUES.md`
4. Contact the development team

---

**Last Updated:** December 2024  
**Version:** 1.0.0
