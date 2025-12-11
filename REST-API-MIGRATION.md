# REST API Migration Guide

## Overview

Migrated all data fetching from direct Supabase queries to REST API endpoints. This provides:
- Centralized business logic
- Better security with proper authentication
- Activity logging for admin actions
- Standardized response format
- Preparation for OneSignal notifications

## Architecture

```
Frontend (React Query)
    ↓
API Client (/lib/api-client.ts)
    ↓
REST API Endpoints (/app/api/*)
    ↓
Core Layer (_core/*)
    ↓
Supabase (via service role)
```

## API Endpoints

### Products

**GET /api/products**
- List products with filtering
- Query params: `category_id`, `seller_id`, `status`, `is_active`, `page`, `limit`
- Returns: `{ products: [], pagination: {} }`

**GET /api/products/:id**
- Get product details with images
- Returns: Full product with category, seller, images

**POST /api/products**
- Create new product
- Auth: Required
- Body: `{ name, description, condition, base_price, selling_price, negotiable, category_id, images[] }`
- Logs: `CREATE_PRODUCT`

**PUT /api/products/:id**
- Update product
- Auth: Required (owner or admin)
- Logs: `UPDATE_PRODUCT`

**DELETE /api/products/:id**
- Soft delete product (set is_active = false)
- Auth: Required (owner or admin)
- Logs: `DELETE_PRODUCT`

### Negotiations

**GET /api/negotiations**
- List negotiations
- Auth: Required
- Filters: `product_id`, `status`, `page`, `limit`
- Returns: Negotiations with product and buyer details

**POST /api/negotiations**
- Create negotiation
- Auth: Required
- Body: `{ product_id, offer_price, note? }`
- Creates notification for admin
- Returns: New negotiation

**POST /api/negotiations/:id/approve**
- Approve negotiation
- Auth: Admin only
- Body: `{ final_price }`
- Creates notification for buyer
- Logs: `APPROVE_NEGOTIATION`

**POST /api/negotiations/:id/reject**
- Reject negotiation
- Auth: Admin only
- Body: `{ note? }`
- Creates notification for buyer
- Logs: `REJECT_NEGOTIATION`

### Orders

**GET /api/orders**
- List orders
- Auth: Required
- Filters: `order_status`, `page`, `limit`
- Users see only their orders, admins see all

**POST /api/orders**
- Create order
- Auth: Required
- Body: `{ product_id, negotiation_id?, payment_method, shipping_address, note? }`
- Validates negotiation (must be approved, not used)
- Marks negotiation as used
- Creates notification for seller
- Logs: `CREATE_ORDER`

**PUT /api/orders/:id/status**
- Update order status
- Auth: Admin only
- Body: `{ status, admin_note? }`
- Status: `pending | processing | completed | canceled`
- Creates notification for buyer
- Logs: `UPDATE_ORDER_STATUS`

### Notifications

**GET /api/notifications**
- List user notifications
- Auth: Required
- Query params: `unread`, `page`, `limit`
- Returns user's notifications only

**POST /api/notifications/send**
- Send notification (admin only)
- Auth: Admin only
- Body: `{ user_id, type, title, message, data? }`
- Types: `new_negotiation`, `negotiation_approved`, `negotiation_rejected`, `new_order`, `order_status_updated`, `system_message`

### Users

**GET /api/users/me**
- Get current user profile
- Auth: Required
- Returns profile with role info

**GET /api/users**
- List all users
- Auth: Admin only
- Query params: `role`, `page`, `limit`

### Activity Logs

**GET /api/activity**
- Get activity logs
- Auth: Admin only
- Query params: `admin_id`, `action`, `page`, `limit`
- Returns admin action history

## Core Modules

### supabase-server.ts
- Admin Supabase client (service role)
- Helper functions: `getUserFromAuth()`, `isUserAdmin()`

### response.ts
- Standard response format
- Functions: `successResponse()`, `errorResponse()`, `unauthorizedResponse()`, etc.

### auth.ts
- Authentication middleware
- Functions: `requireAuth()`, `requireAdmin()`
- Returns `{ userId, isAdmin }`

### validator.ts
- Zod schema validation
- Functions: `validatePayload()`, `parseRequestBody()`

### error.ts
- Error handling
- Functions: `handleApiError()`, `ApiError` class

### activity-logger.ts
- Activity logging
- Function: `logActivity({ admin_id, action, meta })`

## Response Format

### Success Response
```json
{
  "success": true,
  "data": {},
  "message": "Operation successful"
}
```

### Error Response
```json
{
  "success": false,
  "error": "Error message"
}
```

### Paginated Response
```json
{
  "success": true,
  "data": {
    "products": [],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 100,
      "totalPages": 5
    }
  }
}
```

## Frontend Usage

### API Client

```typescript
import { api } from '@/lib/api-client'

// Products
const { data } = await api.getProducts({ category_id: '123', page: 1 })
const product = await api.getProduct('product-id')
await api.createProduct({ name: 'Product', ... })
await api.updateProduct('id', { name: 'Updated' })
await api.deleteProduct('id')

// Negotiations
const { data } = await api.getNegotiations({ status: 'pending' })
await api.createNegotiation({ product_id: '123', offer_price: 1000 })
await api.approveNegotiation('neg-id', 950)
await api.rejectNegotiation('neg-id', 'Reason')

// Orders
const { data } = await api.getOrders({ order_status: 'pending' })
await api.createOrder({ product_id: '123', ... })
await api.updateOrderStatus('order-id', 'completed')

// Notifications
const { data } = await api.getNotifications({ unread: true })

// Users
const user = await api.getCurrentUser()
const users = await api.getUsers({ role: 'admin' })

// Activity
const logs = await api.getActivityLogs({ action: 'CREATE_PRODUCT' })
```

### React Query Integration

```typescript
import { useQuery, useMutation } from '@tanstack/react-query'
import { api } from '@/lib/api-client'

// Query
const { data, isLoading } = useQuery({
  queryKey: ['products', { page: 1 }],
  queryFn: () => api.getProducts({ page: 1 })
})

// Mutation
const mutation = useMutation({
  mutationFn: (data) => api.createProduct(data),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['products'] })
  }
})
```

## Database Migrations

### Required Tables

1. **notifications**
   - id, user_id, type, title, message, data, read, created_at
   - RLS: Users see only their notifications

2. **activity_logs**
   - id, admin_id, action, meta, created_at
   - RLS: Admins only

### Run Migrations

```sql
-- In Supabase SQL Editor
\i supabase/migrations/20251211_create_notifications_activity.sql
```

## Activity Log Actions

- `CREATE_PRODUCT` - Product created
- `UPDATE_PRODUCT` - Product updated
- `DELETE_PRODUCT` - Product deleted
- `APPROVE_NEGOTIATION` - Negotiation approved
- `REJECT_NEGOTIATION` - Negotiation rejected
- `CREATE_ORDER` - Order created
- `UPDATE_ORDER_STATUS` - Order status changed

## Notification Types

- `new_negotiation` - New price offer submitted
- `negotiation_approved` - Offer approved by admin
- `negotiation_rejected` - Offer rejected by admin
- `new_order` - New order placed
- `order_status_updated` - Order status changed
- `system_message` - General system notification

## Security

### Authentication
- JWT token from Supabase auth
- Passed via `Authorization: Bearer <token>` header
- Validated in `requireAuth()` middleware

### Authorization
- `requireAuth()` - Any authenticated user
- `requireAdmin()` - Admin role required
- RLS policies enforce data access at database level

### Service Role
- API uses service role key
- Bypasses RLS for authorized operations
- Additional checks in application code

## OneSignal Integration

All notification-creating endpoints are ready for OneSignal:
- Notification records created in database
- Player IDs stored in profiles
- Ready to trigger push notifications

TODO markers added for OneSignal triggers:
```typescript
// TODO: Trigger OneSignal push notification
```

## Migration Checklist

- [x] Core API infrastructure
- [x] Products endpoints
- [x] Negotiations endpoints  
- [x] Orders endpoints
- [x] Notifications endpoints
- [x] Users endpoints
- [x] Activity logs endpoints
- [x] API client wrapper
- [x] Database migrations
- [ ] Frontend refactor (replace direct Supabase queries)
- [ ] Update React Query keys
- [ ] Add OneSignal triggers
- [ ] Testing

## Next Steps

1. **Frontend Refactor**
   - Replace all `supabase.from()` calls with `api.*()` calls
   - Update React Query hooks
   - Test all features

2. **OneSignal**
   - Add OneSignal API calls in notification endpoints
   - Test push notifications

3. **Testing**
   - Test all endpoints
   - Verify authentication
   - Check activity logging
   - Validate RLS policies

---

**Migration Date**: December 11, 2025  
**Status**: API Complete, Frontend Refactor Pending
