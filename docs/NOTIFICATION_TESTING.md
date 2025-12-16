# End-to-End Notification Testing Guide

## Overview

This guide provides step-by-step instructions to test the notification system without requiring UI implementation. All tests can be performed using Postman or cURL.

---

## Prerequisites

### 1. Environment Setup

Ensure `.env.local` contains:
```bash
ONESIGNAL_APP_ID=your-app-id
ONESIGNAL_REST_API_KEY=your-rest-api-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 2. Database Access

You need access to Supabase dashboard or psql to verify database records.

### 3. Test Users

Create test accounts:
- **Admin User**: Has `role = 'admin'` in `profiles` table
- **Regular User**: Has `role = 'user'` in `profiles` table

### 4. OneSignal Test Device

Install OneSignal test app or use OneSignal dashboard to generate test `player_id`.

---

## Test Suite

## Test 1: Register OneSignal Player ID

**Purpose**: Verify player_id registration flow

**Endpoint**: `POST /api/onesignal/register`

**Request**:
```bash
curl -X POST http://localhost:3000/api/onesignal/register \
  -H "Authorization: Bearer {user_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "player_id": "test-player-id-12345"
  }'
```

**Expected Response**:
```json
{
  "success": true,
  "message": "Player ID registered successfully"
}
```

**Verify in Database**:
```sql
SELECT user_id, onesignal_player_id 
FROM profiles 
WHERE onesignal_player_id = 'test-player-id-12345';
```

**Expected**:
- ✅ User's `onesignal_player_id` updated
- ✅ Player ID cleared from any other users (if previously registered elsewhere)

---

## Test 2: New Negotiation → Admin Notification

**Purpose**: Verify admin receives notification when user creates negotiation

**Endpoint**: `POST /api/negotiations`

**Request**:
```bash
curl -X POST http://localhost:3000/api/negotiations \
  -H "Authorization: Bearer {user_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "product_id": "existing-product-uuid",
    "offer_price": 150000,
    "note": "Can you give me a discount?"
  }'
```

**Expected Response**:
```json
{
  "success": true,
  "message": "Negotiation created successfully",
  "data": {
    "id": "negotiation-uuid",
    "status": "pending",
    ...
  }
}
```

**Verify in Database**:
```sql
-- Check notifications created for all admins
SELECT 
  n.id,
  n.user_id,
  p.full_name,
  p.role,
  n.type,
  n.title,
  n.message,
  n.created_at
FROM notifications n
JOIN profiles p ON p.user_id = n.user_id
WHERE n.type = 'new_negotiation'
ORDER BY n.created_at DESC
LIMIT 10;
```

**Expected**:
- ✅ One notification row per admin user
- ✅ `type = 'new_negotiation'`
- ✅ `title = 'New Price Negotiation'`
- ✅ `message` contains product name and offer price
- ✅ `read_at IS NULL` (unread)

**Verify Push Notification**:
- Check OneSignal dashboard for delivery status
- If admins have `onesignal_player_id`, they should receive push
- Check server logs for: `[NotificationHelper] Bulk push sent to X users`

---

## Test 3: Approve Negotiation → User Notification

**Purpose**: Verify buyer receives notification when admin approves

**Endpoint**: `POST /api/negotiations/{id}/approve`

**Request**:
```bash
curl -X POST http://localhost:3000/api/negotiations/{negotiation-id}/approve \
  -H "Authorization: Bearer {admin_token}" \
  -H "Content-Type: application/json"
```

**Expected Response**:
```json
{
  "success": true,
  "message": "Negotiation approved successfully",
  "data": {
    "status": "approved",
    "final_price": 150000,
    ...
  }
}
```

**Verify in Database**:
```sql
-- Check buyer notification
SELECT 
  n.*,
  p.full_name as recipient_name
FROM notifications n
JOIN profiles p ON p.user_id = n.user_id
WHERE n.type = 'negotiation_approved'
  AND n.user_id = 'buyer-user-id'
ORDER BY n.created_at DESC
LIMIT 1;
```

**Expected**:
- ✅ Notification row for buyer
- ✅ `type = 'negotiation_approved'`
- ✅ `title = 'Negotiation Approved! 🎉'`
- ✅ `message` contains final price
- ✅ `data` includes `negotiation_id`, `final_price`

**Verify Push Notification**:
- If buyer has `onesignal_player_id`, push should be sent
- Check OneSignal dashboard for delivery
- Buyer should see push notification on device

---

## Test 4: Reject Negotiation → User Notification

**Purpose**: Verify buyer receives notification when admin rejects

**Endpoint**: `POST /api/negotiations/{id}/reject`

**Request**:
```bash
curl -X POST http://localhost:3000/api/negotiations/{negotiation-id}/reject \
  -H "Authorization: Bearer {admin_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "note": "Price too low, cannot accept"
  }'
```

**Expected Response**:
```json
{
  "success": true,
  "message": "Negotiation rejected",
  "data": {
    "status": "rejected",
    ...
  }
}
```

**Verify in Database**:
```sql
SELECT * FROM notifications 
WHERE type = 'negotiation_rejected'
  AND user_id = 'buyer-user-id'
ORDER BY created_at DESC 
LIMIT 1;
```

**Expected**:
- ✅ Notification row for buyer
- ✅ `type = 'negotiation_rejected'`
- ✅ `title = 'Negotiation Rejected ❌'`
- ✅ `message` includes rejection note
- ✅ Push sent (if player_id exists)

---

## Test 5: Counter Offer → User Notification

**Purpose**: Verify buyer receives notification when admin counters

**Endpoint**: `POST /api/negotiations/{id}/counter`

**Request**:
```bash
curl -X POST http://localhost:3000/api/negotiations/{negotiation-id}/counter \
  -H "Authorization: Bearer {admin_token}" \
  -H "Content-Type: application/json"
```

**Expected Response**:
```json
{
  "success": true,
  "message": "Counter offer generated",
  "data": {
    "negotiation": { ... },
    "counter_price": 175000,
    "message": "System-generated counter offer sent successfully"
  }
}
```

**Verify in Database**:
```sql
SELECT * FROM notifications 
WHERE type = 'negotiation_countered'
  AND user_id = 'buyer-user-id'
ORDER BY created_at DESC 
LIMIT 1;
```

**Expected**:
- ✅ Notification row for buyer
- ✅ `type = 'negotiation_countered'`
- ✅ `title = 'Counter Offer Received'`
- ✅ `message` includes counter price
- ✅ `data` includes `counter_price`, `counter_attempt`

---

## Test 6: New Order → Admin Notification

**Purpose**: Verify admins receive notification when user creates order

**Endpoint**: `POST /api/orders`

**Request**:
```bash
curl -X POST http://localhost:3000/api/orders \
  -H "Authorization: Bearer {user_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "product_id": "product-uuid",
    "negotiation_id": "negotiation-uuid",
    "payment_method": "bank_transfer",
    "shipping_address": "Jl. Test No. 123, Jakarta",
    "note": "Please pack carefully"
  }'
```

**Expected Response**:
```json
{
  "success": true,
  "message": "Order created successfully",
  "data": {
    "id": "order-uuid",
    "order_status": "pending",
    ...
  }
}
```

**Verify in Database**:
```sql
-- Check all admin notifications
SELECT 
  n.id,
  p.full_name as admin_name,
  n.type,
  n.title,
  n.message,
  n.data
FROM notifications n
JOIN profiles p ON p.user_id = n.user_id
WHERE n.type = 'new_order'
  AND p.role = 'admin'
ORDER BY n.created_at DESC;
```

**Expected**:
- ✅ One notification per admin
- ✅ `type = 'new_order'`
- ✅ `title = 'New Order Received'`
- ✅ `message` contains product name and price
- ✅ `data` includes `order_id`, `product_id`, `price`

---

## Test 7: Order Status Update → User Notification

**Purpose**: Verify buyer receives notification when order status changes

**Endpoint**: `PUT /api/orders/{id}/status`

**Request**:
```bash
curl -X PUT http://localhost:3000/api/orders/{order-id}/status \
  -H "Authorization: Bearer {admin_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "order_status": "processing",
    "admin_note": "Order is being prepared for shipment"
  }'
```

**Expected Response**:
```json
{
  "success": true,
  "message": "Order status updated successfully",
  "data": {
    "order_status": "processing",
    ...
  }
}
```

**Verify in Database**:
```sql
SELECT * FROM notifications 
WHERE type = 'order_status_updated'
  AND user_id = 'buyer-user-id'
ORDER BY created_at DESC 
LIMIT 1;
```

**Expected**:
- ✅ Notification row for buyer
- ✅ `type = 'order_status_updated'`
- ✅ `title = 'Order Status Updated 📦'`
- ✅ `message` reflects new status
- ✅ `data` includes `order_id`, `order_status`, `note`

---

## Test 8: Notification Read Status

**Purpose**: Verify marking notifications as read

**Endpoint**: `PATCH /api/notifications/{id}/read`

**Request**:
```bash
curl -X PATCH http://localhost:3000/api/notifications/{notification-id}/read \
  -H "Authorization: Bearer {user_token}"
```

**Expected Response**:
```json
{
  "success": true,
  "message": "Notification marked as read"
}
```

**Verify in Database**:
```sql
SELECT id, read_at 
FROM notifications 
WHERE id = 'notification-id';
```

**Expected**:
- ✅ `read_at` is now set to current timestamp
- ✅ Unread count decremented for user

---

## Test 9: Unread Count

**Purpose**: Verify unread notification count

**Endpoint**: `GET /api/notifications/unread-count`

**Request**:
```bash
curl -X GET http://localhost:3000/api/notifications/unread-count \
  -H "Authorization: Bearer {user_token}"
```

**Expected Response**:
```json
{
  "success": true,
  "data": {
    "unread_count": 5
  }
}
```

**Verify in Database**:
```sql
SELECT COUNT(*) as unread_count
FROM notifications
WHERE user_id = 'user-id'
  AND read_at IS NULL;
```

**Expected**:
- ✅ Count matches database query result

---

## Test 10: Notification List with Pagination

**Purpose**: Verify fetching user's notifications

**Endpoint**: `GET /api/notifications?page=1&limit=10`

**Request**:
```bash
curl -X GET 'http://localhost:3000/api/notifications?page=1&limit=10' \
  -H "Authorization: Bearer {user_token}"
```

**Expected Response**:
```json
{
  "success": true,
  "data": {
    "notifications": [
      {
        "id": "uuid",
        "type": "negotiation_approved",
        "title": "Negotiation Approved! 🎉",
        "message": "Your offer has been approved",
        "read_at": null,
        "created_at": "2024-01-15T10:30:00Z"
      },
      ...
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 25,
      "totalPages": 3
    }
  }
}
```

**Expected**:
- ✅ Returns user's notifications only (security)
- ✅ Sorted by `created_at DESC` (newest first)
- ✅ Pagination metadata correct

---

## Test 11: Push Notification Failure Handling

**Purpose**: Verify system handles push failures gracefully

**Scenario**: User has no `onesignal_player_id`

**Setup**:
```sql
-- Remove player_id from test user
UPDATE profiles 
SET onesignal_player_id = NULL 
WHERE user_id = 'test-user-id';
```

**Trigger**: Create any event that sends notification to this user

**Expected Behavior**:
1. ✅ API returns success (200/201)
2. ✅ DB notification created
3. ⚠️ No push sent (no player_id)
4. ✅ Server logs: `[NotificationHelper] No player_id found, skipping push`

**Verify**:
```sql
-- Notification should still exist in DB
SELECT * FROM notifications 
WHERE user_id = 'test-user-id'
ORDER BY created_at DESC 
LIMIT 1;
```

---

## Test 12: OneSignal API Error Handling

**Purpose**: Verify system handles OneSignal API errors

**Scenario**: Invalid OneSignal credentials

**Setup**:
```bash
# Temporarily set invalid API key in .env.local
ONESIGNAL_REST_API_KEY=invalid-key-12345
```

**Trigger**: Create any event that sends notification

**Expected Behavior**:
1. ✅ API returns success
2. ✅ DB notification created
3. ⚠️ Push fails (invalid credentials)
4. ✅ Server logs error: `[NotificationHelper] Push failed (DB record exists): <error>`

**Verify**:
```sql
-- Notification should still exist despite push failure
SELECT * FROM notifications 
WHERE type = 'new_negotiation'
ORDER BY created_at DESC 
LIMIT 1;
```

**Restore**:
```bash
# Restore valid credentials
ONESIGNAL_REST_API_KEY=your-valid-key
```

---

## Test Matrix

| Test | Endpoint | Recipient | DB | Push | Status |
|------|----------|-----------|----|----- |--------|
| 1    | `/onesignal/register` | N/A | ✅ | N/A | Setup |
| 2    | `POST /negotiations` | Admin | ☐ | ☐ | Pending |
| 3    | `POST /negotiations/{id}/approve` | User | ☐ | ☐ | Pending |
| 4    | `POST /negotiations/{id}/reject` | User | ☐ | ☐ | Pending |
| 5    | `POST /negotiations/{id}/counter` | User | ☐ | ☐ | Pending |
| 6    | `POST /orders` | Admin | ☐ | ☐ | Pending |
| 7    | `PUT /orders/{id}/status` | User | ☐ | ☐ | Pending |
| 8    | `PATCH /notifications/{id}/read` | Self | ☐ | N/A | Pending |
| 9    | `GET /notifications/unread-count` | Self | ☐ | N/A | Pending |
| 10   | `GET /notifications` | Self | ☐ | N/A | Pending |
| 11   | Any | No player_id | ☐ | ⚠️ | Pending |
| 12   | Any | Invalid API key | ☐ | ⚠️ | Pending |

**Legend**:
- ✅ = Passed
- ☐ = Not yet tested
- ⚠️ = Expected failure (graceful)
- ❌ = Failed (needs fix)

---

## Automated Testing Script

Save this as `test-notifications.sh`:

```bash
#!/bin/bash

# Configuration
BASE_URL="http://localhost:3000"
ADMIN_TOKEN="your-admin-token"
USER_TOKEN="your-user-token"

echo "=== Notification System E2E Tests ==="
echo ""

# Test 1: Register Player ID
echo "Test 1: Register Player ID"
curl -X POST "$BASE_URL/api/onesignal/register" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"player_id": "test-player-id-12345"}' \
  -s | jq '.'
echo ""

# Test 2: Create Negotiation (Admin Notification)
echo "Test 2: Create Negotiation → Admin Notification"
NEGOTIATION_ID=$(curl -X POST "$BASE_URL/api/negotiations" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"product_id": "existing-product-uuid", "offer_price": 150000}' \
  -s | jq -r '.data.id')
echo "Created negotiation: $NEGOTIATION_ID"
echo ""

# Test 3: Approve Negotiation (User Notification)
echo "Test 3: Approve Negotiation → User Notification"
curl -X POST "$BASE_URL/api/negotiations/$NEGOTIATION_ID/approve" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -s | jq '.'
echo ""

# Test 4: Check Unread Count
echo "Test 4: Check Unread Notification Count"
curl -X GET "$BASE_URL/api/notifications/unread-count" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -s | jq '.'
echo ""

echo "=== Tests Complete ==="
```

Run with:
```bash
chmod +x test-notifications.sh
./test-notifications.sh
```

---

## Common Issues & Solutions

### Issue: No notifications created

**Check**:
1. API returns success? (200/201)
2. Check server logs for errors
3. Verify database connection

**Solution**: Check `notification-helper.ts` error logs

---

### Issue: DB notification created but no push

**Expected** if:
- User has no `onesignal_player_id`
- OneSignal credentials invalid

**Check**:
```sql
SELECT onesignal_player_id FROM profiles WHERE user_id = 'user-id';
```

**Solution**: 
- Register player_id via `/api/onesignal/register`
- Verify OneSignal credentials in `.env.local`

---

### Issue: Push sent but no DB record

**This should NEVER happen** with centralized system.

If it does:
- ❌ Code is bypassing centralized helper
- ✅ Review recent code changes
- ✅ Ensure using `lib/notifications/notification-helper.ts`

---

## Success Criteria

All tests pass when:
- ✅ All 12 tests return expected results
- ✅ Database records match expected structure
- ✅ Push notifications delivered (when player_id exists)
- ✅ Error handling works gracefully
- ✅ No errors in server logs (except expected push failures)

---

## Next Steps After Testing

1. ✅ Document test results
2. ✅ Fix any failing tests
3. ✅ Update notification trigger matrix with test status
4. ✅ Integrate with mobile app
5. ✅ Monitor production notification delivery rate

---

**Last Updated**: 2024-01-15
**Test Environment**: Local Development
**Tester**: Backend Team
