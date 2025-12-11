# OneSignal Integration Deployment Guide

## Prerequisites

1. OneSignal Account: https://onesignal.com
2. OneSignal App created (Web Push)
3. App ID and REST API Key

## Environment Variables

Add to `.env.local` and Vercel:

```env
NEXT_PUBLIC_ONESIGNAL_APP_ID=your-app-id-here
NEXT_PUBLIC_ONESIGNAL_API_KEY=your-rest-api-key-here
```

## Database Migration

Run the migration to add `onesignal_player_id` column:

```sql
-- In Supabase SQL Editor
\i supabase/migrations/20251210_add_onesignal_player_id.sql
```

Or manually:

```sql
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS onesignal_player_id TEXT;

CREATE INDEX IF NOT EXISTS idx_profiles_onesignal_player_id 
ON profiles(onesignal_player_id);
```

## OneSignal Setup

### 1. Create OneSignal App

1. Go to https://onesignal.com/apps
2. Click "New App/Website"
3. Select "Web Push" platform
4. Enter your site details
5. Complete the setup wizard

### 2. Get Credentials

1. Go to Settings → Keys & IDs
2. Copy **App ID** 
3. Copy **REST API Key**
4. Add to environment variables

### 3. Configure Web Push

1. Go to Settings → Web Configuration
2. Set **Site URL**: `https://yourdomain.com` (or localhost for dev)
3. Upload icon (optional): 256x256 PNG
4. Default Notification Icon: Public URL of your icon
5. Save configuration

### 4. Service Worker Files

Already configured in `/public/`:
- `OneSignalSDKWorker.js`
- `OneSignalSDK.sw.js`
- `OneSignalSDKUpdaterWorker.js`

These files are automatically served from root domain.

## Features Implemented

### 1. Auto-initialization
- OneSignal initializes when app loads
- Requests notification permission
- Saves player ID to localStorage and database

### 2. Player ID Sync
- After login, player ID syncs to user profile
- Hook: `useOneSignalSync()` in AdminLayout
- Action: `updateUserPlayerId()` in onesignal-actions.ts

### 3. Settings Page
- `/settings` - Configure OneSignal credentials
- Test notifications functionality
- Visual status indicators

### 4. Edge Functions Integration

OneSignal is used in Edge Functions:
- `on-negotiation-created` - Notify admins of new offers
- `on-negotiation-status-updated` - Notify users of status changes
- `on-order-created` - Notify admins of new orders
- `on-order-status-updated` - Notify users of order updates

## Testing

### Local Testing

1. Start dev server:
```bash
pnpm dev
```

2. Open browser console
3. Allow notification permission when prompted
4. Check console for:
   - "OneSignal permission: granted"
   - "OneSignal Player ID: xxx"
   - "Player ID synced successfully"

### Test Notification

1. Login as admin
2. Go to `/settings`
3. Enter OneSignal credentials
4. Click "Test Notification"
5. Check browser for notification

### Test Edge Functions

1. Create a negotiation (as user)
2. Check if admin receives notification
3. Approve/reject negotiation (as admin)
4. Check if user receives notification

## Troubleshooting

### No Player ID Generated

**Issue**: Player ID not appearing in console

**Solutions**:
1. Check if notification permission granted
2. Clear browser cache and localStorage
3. Ensure HTTPS (or localhost with allowLocalhostAsSecureOrigin)
4. Check OneSignal App ID is correct

### Notifications Not Received

**Issue**: No notifications appearing

**Solutions**:
1. Verify OneSignal credentials in Settings
2. Check player ID saved in database:
   ```sql
   SELECT user_id, onesignal_player_id FROM profiles;
   ```
3. Check browser notification settings
4. Test from OneSignal Dashboard: Messages → New Push

### Service Worker Not Loading

**Issue**: Service worker registration fails

**Solutions**:
1. Check `/OneSignalSDKWorker.js` accessible
2. Clear service worker cache:
   - Chrome DevTools → Application → Service Workers → Unregister
3. Verify `next.config.ts` headers configuration
4. Restart dev server

### CORS Errors

**Issue**: CORS policy blocking OneSignal

**Solutions**:
1. Ensure site URL matches in OneSignal settings
2. For localhost: Enable `allowLocalhostAsSecureOrigin: true`
3. For production: Add domain to OneSignal whitelist

## Deployment Checklist

- [ ] Environment variables added to Vercel
- [ ] Database migration executed in Supabase
- [ ] OneSignal App configured with production URL
- [ ] Service worker files in `/public/` directory
- [ ] Test notifications working
- [ ] Edge Functions have OneSignal API key in secrets
- [ ] HTTPS enabled on production domain

## Edge Function Configuration

Add OneSignal secrets to Supabase Edge Functions:

```bash
# Using Supabase CLI
supabase secrets set ONESIGNAL_APP_ID=your-app-id
supabase secrets set ONESIGNAL_API_KEY=your-api-key
```

Or via Supabase Dashboard:
1. Project Settings → Edge Functions
2. Add secrets: `ONESIGNAL_APP_ID`, `ONESIGNAL_API_KEY`

## Monitoring

### Check Player ID Registration

```sql
SELECT 
  u.email,
  p.role,
  p.onesignal_player_id,
  p.created_at
FROM profiles p
JOIN auth.users u ON p.user_id = u.id
WHERE p.onesignal_player_id IS NOT NULL;
```

### Check Notification Logs

In OneSignal Dashboard:
1. Go to Delivery → All Messages
2. View sent notifications
3. Check delivery rates
4. View click-through rates

## Support

- OneSignal Docs: https://documentation.onesignal.com/
- Supabase Edge Functions: https://supabase.com/docs/guides/functions
- Issues: Contact development team

---

**Last Updated**: December 10, 2025
**Version**: 1.0.0
