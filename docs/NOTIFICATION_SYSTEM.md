# Notification System Documentation

## Overview

The notification system ensures **dual delivery**: every notification is saved to the database (source of truth) AND sent via OneSignal push notification (best effort). This guarantees consistency and prevents notification loss.

---

## Architecture

### Centralized Helper: `notification-helper.ts`

**Location**: `src/lib/notifications/notification-helper.ts`

**Core Functions**:

1. **`sendUserNotification(params)`** - Send notification to single user
2. **`sendBulkNotification(params)`** - Send notification to multiple users
3. **`sendAdminNotification(params)`** - Send notification to all admins

### Flow Diagram

```
API Endpoint
    │
    ├─► sendUserNotification()
    │       │
    │       ├─► 1. Insert to notifications table (DB)
    │       │       └─► Source of truth ✅
    │       │
    │       └─► 2. Send OneSignal push (if player_id exists)
    │               └─► Best effort (failure logged, doesn't block) ⚠️
    │
    └─► Return success (even if push fails)
```

---

## Notification Types

Enum defined in `notification-helper.ts`:

```typescript
type NotificationType =
  | 'new_negotiation'          // User creates price negotiation
  | 'negotiation_approved'     // Admin approves negotiation
  | 'negotiation_rejected'     // Admin rejects negotiation
  | 'negotiation_countered'    // Admin sends counter offer
  | 'new_order'                // User creates order
  | 'order_status_updated'     // Admin updates order status
  | 'order_payment_updated'    // Payment status changes (future)
  | 'system_message'           // Admin broadcasts message
```

---

## Notification Trigger Matrix

| Event                          | Recipient | API Endpoint                             | DB | Push | Status |
|--------------------------------|-----------|------------------------------------------|----|----- |--------|
| User creates negotiation       | Admin     | `POST /api/negotiations`                 | ✅ | ✅   | ✅     |
| Admin approves negotiation     | User      | `POST /api/negotiations/[id]/approve`    | ✅ | ✅   | ✅     |
| Admin rejects negotiation      | User      | `POST /api/negotiations/[id]/reject`     | ✅ | ✅   | ✅     |
| Admin counters negotiation     | User      | `POST /api/negotiations/[id]/counter`    | ✅ | ✅   | ✅     |
| User creates order             | Admin     | `POST /api/orders`                       | ✅ | ✅   | ✅     |
| Admin updates order status     | User      | `PUT /api/orders/[id]/status`            | ✅ | ✅   | ✅     |

**Legend**:
- ✅ = Implemented and tested
- ⏳ = Pending implementation
- ❌ = Not implemented

---

## Usage Examples

### 1. Send Notification to Single User

```typescript
import { sendUserNotification } from '@/lib/notifications/notification-helper'

// Example: Notify buyer when negotiation is approved
await sendUserNotification({
  userId: buyer_id,
  type: 'negotiation_approved',
  title: 'Negotiation Approved! 🎉',
  message: `Your offer for ${product.name} has been approved at Rp ${finalPrice.toLocaleString('id-ID')}`,
  data: {
    negotiation_id: negotiation.id,
    final_price: finalPrice,
  },
  url: `${process.env.NEXT_PUBLIC_APP_URL}/negotiations/${negotiation.id}`,
})
```

### 2. Send Notification to All Admins

```typescript
import { sendAdminNotification } from '@/lib/notifications/notification-helper'

// Example: Notify admins when new order is created
await sendAdminNotification({
  type: 'new_order',
  title: 'New Order Received',
  message: `New order for ${product.name} - Rp ${finalPrice.toLocaleString('id-ID')}`,
  data: {
    order_id: order.id,
    product_id: product.id,
    price: finalPrice,
  },
  url: `${process.env.NEXT_PUBLIC_APP_URL}/orders/${order.id}`,
})
```

### 3. Send Notification to Multiple Specific Users

```typescript
import { sendBulkNotification } from '@/lib/notifications/notification-helper'

// Example: Notify specific users about system maintenance
await sendBulkNotification({
  userIds: ['user-id-1', 'user-id-2', 'user-id-3'],
  type: 'system_message',
  title: 'System Maintenance',
  message: 'Scheduled maintenance on Sunday 2AM - 4AM',
  data: {
    maintenance_start: '2024-01-15T02:00:00Z',
    maintenance_end: '2024-01-15T04:00:00Z',
  },
})
```

---

## Data Structure

### Notifications Table Schema

```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB DEFAULT '{}'::jsonb,
  read_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX idx_notifications_read_at ON notifications(read_at) WHERE read_at IS NULL;
```

### OneSignal Push Notification Payload

```typescript
{
  app_id: process.env.ONESIGNAL_APP_ID,
  include_player_ids: ['player-id-1', 'player-id-2'],
  headings: { en: "Notification Title" },
  contents: { en: "Notification message body" },
  data: {
    // Custom data for app to handle
    negotiation_id: "uuid",
    type: "negotiation_approved",
    final_price: 150000
  },
  url: "https://app.dntcell.com/negotiations/uuid" // Deep link
}
```

---

## Error Handling

### Database Insert Failure
- **Behavior**: Function returns `{ success: false, error: "..." }`
- **Impact**: Critical - notification lost entirely
- **Action**: Log error, display error to user, retry if possible

### Push Notification Failure
- **Behavior**: Error logged to console, function still returns success
- **Impact**: Low - notification saved in DB, user can see in-app
- **Action**: User will see notification in app when they check
- **Common causes**:
  - User has no `onesignal_player_id` (not logged in on mobile)
  - OneSignal API key invalid
  - Network timeout

Example error handling:

```typescript
const result = await sendUserNotification({ /* ... */ })

if (!result.success) {
  console.error('[Notification] Failed to send:', result.error)
  // Handle critical DB failure
  // Maybe show error to user or retry
}

// Push failure is already logged internally, no action needed
```

---

## OneSignal Player ID Management

### Registration Flow

1. **User logs in** on mobile app
2. **OneSignal SDK** generates `player_id`
3. **Mobile app** calls `POST /api/onesignal/register` with `player_id`
4. **Backend** saves to `profiles.onesignal_player_id`
5. **Backend** clears `player_id` from other users (prevent duplication)

### Endpoint: `POST /api/onesignal/register`

```typescript
// Request
POST /api/onesignal/register
{
  "player_id": "abc123-onesignal-player-id"
}

// Response
{
  "success": true,
  "message": "Player ID registered successfully"
}
```

**Security**:
- Requires authentication
- Clears player_id from other users (devices can only belong to one user)
- Idempotent (re-registering same player_id is safe)

---

## Testing Guide

### Prerequisites
- OneSignal account with valid `ONESIGNAL_APP_ID` and `ONESIGNAL_REST_API_KEY`
- Test user with `onesignal_player_id` in database
- Postman or similar API testing tool

### Test Cases

#### 1. Test User Notification (Single)

**Request**:
```bash
POST /api/negotiations/{id}/approve
Authorization: Bearer {admin_token}
Content-Type: application/json
```

**Expected**:
1. ✅ Row inserted in `notifications` table
2. ✅ Push notification sent to buyer's device
3. ✅ Notification appears in user's notification list
4. ✅ `unread_count` incremented for user

**Verify**:
```sql
SELECT * FROM notifications 
WHERE user_id = 'buyer-id' 
  AND type = 'negotiation_approved' 
ORDER BY created_at DESC 
LIMIT 1;
```

#### 2. Test Admin Notification (Bulk)

**Request**:
```bash
POST /api/negotiations
Authorization: Bearer {user_token}
Content-Type: application/json

{
  "product_id": "uuid",
  "offer_price": 150000,
  "note": "Test negotiation"
}
```

**Expected**:
1. ✅ Multiple rows inserted in `notifications` table (one per admin)
2. ✅ Push sent to all admins with `onesignal_player_id`
3. ✅ All admins see notification in their list

**Verify**:
```sql
SELECT COUNT(*) FROM notifications 
WHERE type = 'new_negotiation'
  AND user_id IN (
    SELECT user_id FROM profiles WHERE role = 'admin'
  );
```

#### 3. Test Push Failure Handling

**Scenario**: User has no `onesignal_player_id`

**Request**: Any endpoint that sends notification

**Expected**:
1. ✅ DB notification still created
2. ⚠️ Push notification skipped (no player_id)
3. ✅ API returns success
4. ✅ Console logs: "No player_id found, skipping push"

**Verify**:
```sql
SELECT onesignal_player_id FROM profiles WHERE user_id = 'test-user-id';
-- Should be NULL

SELECT * FROM notifications WHERE user_id = 'test-user-id';
-- Should have notification row despite no push
```

---

## Troubleshooting

### Issue: Notifications not appearing in app

**Check**:
1. ✅ DB row exists: `SELECT * FROM notifications WHERE user_id = 'user-id'`
2. ✅ User has `onesignal_player_id`: `SELECT onesignal_player_id FROM profiles WHERE user_id = 'user-id'`
3. ✅ OneSignal credentials valid: Check `.env.local` for `ONESIGNAL_APP_ID` and `ONESIGNAL_REST_API_KEY`
4. ✅ Check server logs for push errors

### Issue: Push notification sent but no DB record

**This should NEVER happen** with centralized helper.

If it does:
- ❌ Code is NOT using centralized helper
- ❌ Someone called `sendUserNotification()` from `lib/onesignal.ts` directly
- ✅ **FIX**: Replace with `sendUserNotification()` from `lib/notifications/notification-helper.ts`

### Issue: DB record exists but no push sent

**Expected behavior** if:
- User has no `onesignal_player_id` (not logged in on mobile)
- OneSignal API error (logged to console)

**Check console logs** for:
```
[NotificationHelper] Push failed (DB record exists): <error>
```

---

## Migration Notes

### Before (Fragmented)

```typescript
// ❌ OLD WAY - Inconsistent, scattered across endpoints

// Some endpoints: DB only
await supabaseAdmin.from('notifications').insert({ ... })

// Some endpoints: Push only  
await sendUserNotification(userId, title, message)

// Some endpoints: Both manually
await supabaseAdmin.from('notifications').insert({ ... })
sendUserNotification(userId, title, message).catch(console.error)
```

### After (Centralized)

```typescript
// ✅ NEW WAY - One function, guaranteed consistency

import { sendUserNotification } from '@/lib/notifications/notification-helper'

await sendUserNotification({
  userId,
  type: 'negotiation_approved',
  title,
  message,
  data: { ... },
})

// Automatically:
// 1. Inserts to DB (source of truth)
// 2. Sends push (if player_id exists)
// 3. Handles errors gracefully
```

---

## Best Practices

1. **Always use centralized helper** - Never insert to `notifications` table manually
2. **Include meaningful `data`** - Add context for deep linking and app navigation
3. **Use descriptive titles** - Help users understand notification at a glance
4. **Include `url` parameter** - Enable deep linking to relevant screen
5. **Don't block on notification failure** - Notifications are secondary to business logic
6. **Log notification events** - Include notification_id in activity logs for audit trail

---

## Future Enhancements

### Planned Features

- [ ] **Email notifications** - Send email for critical notifications
- [ ] **SMS notifications** - Send SMS for urgent order updates
- [ ] **Notification preferences** - Let users configure notification types
- [ ] **Notification scheduling** - Schedule notifications for future delivery
- [ ] **Rich push notifications** - Include images, actions, etc.
- [ ] **Notification analytics** - Track delivery rate, open rate, etc.

### Database Extensions

```sql
-- Add notification preferences
CREATE TABLE notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id),
  email_enabled BOOLEAN DEFAULT TRUE,
  push_enabled BOOLEAN DEFAULT TRUE,
  sms_enabled BOOLEAN DEFAULT FALSE,
  types JSONB DEFAULT '{}'::jsonb -- Per-type preferences
);

-- Add notification delivery tracking
CREATE TABLE notification_deliveries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  notification_id UUID REFERENCES notifications(id),
  channel TEXT NOT NULL, -- 'push', 'email', 'sms'
  status TEXT NOT NULL, -- 'sent', 'failed', 'delivered', 'opened'
  error TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## Support

For issues or questions:
1. Check server logs for errors
2. Verify database schema matches expected structure
3. Test OneSignal credentials with `/api/settings/onesignal/test`
4. Review this documentation for common issues

**Last Updated**: 2024-01-15
**Maintained By**: Backend Team
