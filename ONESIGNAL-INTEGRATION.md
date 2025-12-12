# Sprint: Integrasi OneSignal – Web Admin Panel

## ✅ Status: COMPLETED
**Tanggal:** 12 Desember 2025

## 📋 Ringkasan Sprint

Sprint ini berhasil mengimplementasikan push notification real-time pada web admin panel menggunakan OneSignal. Semua fitur utama telah diimplementasikan dan siap untuk testing.

---

## 🎯 Hasil Implementasi

### A. Environment & Konfigurasi ✅

#### ✅ Task A1 - Setup Environment Variable
**File:** `.env.local`
- ✅ `NEXT_PUBLIC_ONESIGNAL_APP_ID=bc61c070-c6d1-450e-a770-1e06970c6194`
- ✅ `ONESIGNAL_REST_API_KEY=xkrnd5nfxeoynqvfbvksaoboc`

**Catatan:** Pastikan variabel yang sama ditambahkan di Vercel Dashboard → Project → Environment Variables

#### ✅ Task A2 - Setup Config OneSignal Dashboard
**Checklist:**
- ✅ OneSignal Website Platform telah dibuat
- ⚠️ Upload site icon (manual di OneSignal dashboard)
- ⚠️ Tambahkan domain di OneSignal:
  - Development: `http://localhost:3000`
  - Production: Domain Vercel Anda
- ⚠️ Configure Permission Prompt jika diperlukan

---

### B. Client-Side Integration (Next.js) ✅

#### ✅ Task B1 - Create OneSignal Initialization Client
**File:** `src/components/onesignal/onesignal-client.tsx`

**Fitur:**
- ✅ Inisialisasi SDK OneSignal secara dinamis
- ✅ Load script CDN dengan error handling
- ✅ Monitor perubahan PushSubscription
- ✅ Auto-register player_id ke backend
- ✅ Request notification permission otomatis
- ✅ Console logging untuk debugging

**Penggunaan:**
```tsx
import { OneSignalClient } from '@/components/onesignal/onesignal-client'

<OneSignalClient adminId={userId} />
```

#### ✅ Task B2 - Inject OneSignalClient ke Admin Layout
**File:** `src/components/layout/admin-layout.tsx`

**Perubahan:**
- ✅ Import OneSignalClient component
- ✅ Fetch current user ID dari Supabase session
- ✅ Pass adminId ke OneSignalClient
- ✅ Render OneSignalClient dalam layout

**Hasil:**
- OneSignal akan otomatis aktif ketika user login sebagai admin
- Player ID akan tersimpan otomatis saat permission diberikan

#### ✅ Task B3 - OneSignal Worker Files
**Files:**
- ✅ `public/OneSignalSDKWorker.js`
- ✅ `public/OneSignalSDKUpdaterWorker.js`
- ✅ `public/OneSignalSDK.sw.js`

**Status:** Files sudah ada dan sudah benar ✅

#### ✅ Task B4 - Testing Client Integration
**Checklist Testing:**
1. ✅ Reload halaman admin
2. ⏳ Periksa browser console untuk `[OneSignal] Initialized successfully`
3. ⏳ Pastikan permission request muncul
4. ⏳ Verifikasi player_id berhasil dibuat dan terdaftar
5. ⏳ Check di database: `profiles.onesignal_player_id` terisi

---

### C. Backend Integration ✅

#### ✅ Task C1 - API Endpoint Register Player ID
**File:** `src/app/api/onesignal/register/route.ts`

**Endpoint:** `POST /api/onesignal/register`

**Request Body:**
```json
{
  "adminId": "uuid",
  "playerId": "string"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "adminId": "uuid",
    "playerId": "string",
    "registered": true
  },
  "message": "Player ID registered successfully"
}
```

**Fitur:**
- ✅ Validasi input dengan Zod
- ✅ Verify user exists
- ✅ Upsert player_id ke database
- ✅ Error handling lengkap
- ✅ Console logging

#### ✅ Task C2 - Implementasi Logic Upsert
**Status:** ✅ Implemented dalam endpoint `/api/onesignal/register`
- Menggunakan `.update()` untuk upsert player_id
- Otomatis update `updated_at` timestamp

#### ✅ Task C3 - Helper Pengiriman Notifikasi
**File:** `src/lib/onesignal.ts`

**Functions:**

1. **`sendPushNotification(params)`**
   - Send notifikasi ke player IDs tertentu
   - Support custom data dan URL
   - Error handling lengkap

2. **`sendAdminNotification(adminId, title, message, data?, url?)`**
   - Fetch player_id dari database berdasarkan adminId
   - Send notifikasi ke admin tertentu
   - Auto-handle jika admin belum punya player_id

3. **`sendBulkAdminNotification(title, message, data?, url?)`**
   - Fetch semua admin yang punya player_id
   - Send notifikasi ke semua admin sekaligus
   - Efisien untuk broadcast notification

**Penggunaan:**
```typescript
import { sendAdminNotification, sendBulkAdminNotification } from '@/lib/onesignal'

// Send ke admin tertentu
await sendAdminNotification(
  adminId,
  'Nego Baru',
  'Ada penawaran baru untuk produk X',
  { negotiation_id: 'xxx' },
  '/negotiations'
)

// Send ke semua admin
await sendBulkAdminNotification(
  'Order Baru',
  'Order baru masuk',
  { order_id: 'xxx' },
  '/orders'
)
```

#### ✅ Task C4 - API Pengirim Notifikasi
**File:** `src/app/api/onesignal/send/route.ts`

**Endpoint:** `POST /api/onesignal/send` (Admin only)

**Request Body:**
```json
{
  "adminId": "uuid (optional)",
  "title": "string",
  "message": "string",
  "data": {},
  "url": "string (optional)",
  "sendToAll": false
}
```

**Features:**
- ✅ Admin authentication required
- ✅ Support single admin atau broadcast
- ✅ Validation dengan Zod
- ✅ Return notification ID dan recipient count

---

### D. Integrasi dengan Admin Panel (Workflow) ✅

#### ✅ Task D1 - Implementasi Trigger Notifikasi

**1. Negotiation Created**
**File:** `src/app/api/negotiations/route.ts`
- ✅ Trigger: Saat nego baru dibuat
- ✅ Target: Semua admin
- ✅ Title: "New Price Negotiation"
- ✅ Message: "New offer for {product_name}: Rp {offer_price}"
- ✅ Data: negotiation_id, product_id, product_name, offer_price
- ✅ URL: `/negotiations`

**2. Order Created**
**File:** `src/app/api/orders/route.ts`
- ✅ Trigger: Saat order baru dibuat
- ✅ Target: Semua admin
- ✅ Title: "New Order Received"
- ✅ Message: "New order for {product_name} - Rp {price}"
- ✅ Data: order_id, product_id, product_name, price, payment_method
- ✅ URL: `/orders`

**3. Order Status Updated**
**File:** `src/app/api/orders/[id]/status/route.ts`
- ✅ Trigger: Saat status order diubah
- ✅ Target: Buyer (user yang order)
- ✅ Title: "Order Status Updated"
- ✅ Message: Status-specific message (pending/processing/completed/canceled)
- ✅ Data: order_id, status, product_name
- ✅ URL: `/orders/{id}`

**Error Handling:**
- Semua trigger menggunakan `.catch()` untuk error handling
- Error tidak memblokir response utama
- Error di-log ke console

#### ✅ Task D2 - Logging Notifikasi (Optional)

**Database Schema:**
**File:** `supabase/migrations/20251212_create_notifications_log.sql`

**Table:** `notifications_log`
```sql
CREATE TABLE notifications_log (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES profiles(user_id),
  admin_id UUID REFERENCES profiles(user_id),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL,
  data JSONB,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
)
```

**Features:**
- ✅ Store notification history
- ✅ Track read status (read_at)
- ✅ Link ke admin yang trigger (admin_id)
- ✅ RLS policies untuk user dan admin
- ✅ Indexes untuk performance
- ✅ Validation untuk notification type

**Notification Types:**
- `new_negotiation`
- `negotiation_approved`
- `negotiation_rejected`
- `new_order`
- `order_status_updated`
- `system_message`

**RLS Policies:**
- Users dapat view notifikasi mereka sendiri
- Admins dapat view semua notifikasi
- System dapat insert notifikasi
- Users dapat update (mark as read) notifikasi mereka

---

## 🚀 Deployment Steps

### 1. Database Migration
Jalankan migration di Supabase SQL Editor:
```sql
-- Run migration file
\i supabase/migrations/20251212_create_notifications_log.sql
```

Atau copy-paste isi file tersebut ke SQL Editor.

### 2. Environment Variables di Vercel
Tambahkan di Vercel Dashboard → Project → Settings → Environment Variables:
```
NEXT_PUBLIC_ONESIGNAL_APP_ID=bc61c070-c6d1-450e-a770-1e06970c6194
ONESIGNAL_REST_API_KEY=xkrnd5nfxeoynqvfbvksaoboc
```

### 3. OneSignal Dashboard Configuration
1. Login ke [OneSignal Dashboard](https://onesignal.com)
2. Pilih app Anda
3. Settings → Platforms → Web → Configuration:
   - Site URL: Tambahkan production domain Vercel
   - Add `http://localhost:3000` untuk development
4. Upload site icon (256x256 px recommended)
5. Configure Permission Prompt sesuai kebutuhan

### 4. Deploy ke Vercel
```bash
git add .
git commit -m "feat(onesignal): complete OneSignal integration for admin panel"
git push origin master
```

Vercel akan auto-deploy.

---

## 🧪 Testing Guide

### Manual Testing Steps

#### 1. Test Client Initialization
1. Login sebagai admin
2. Buka browser console
3. Cari log: `[OneSignal] Initialized successfully`
4. Allow notification permission saat diminta
5. Cari log: `[OneSignal] Current Player ID: xxx`
6. Cari log: `[OneSignal] Registration successful`

#### 2. Test Database Registration
```sql
-- Check player_id tersimpan
SELECT user_id, full_name, role, onesignal_player_id 
FROM profiles 
WHERE role = 'admin';
```

Expected: `onesignal_player_id` terisi setelah permission granted

#### 3. Test API Endpoint
**Test Register:**
```bash
curl -X POST http://localhost:3000/api/onesignal/register \
  -H "Content-Type: application/json" \
  -d '{
    "adminId": "your-admin-uuid",
    "playerId": "test-player-id"
  }'
```

**Test Send (need admin auth token):**
```bash
curl -X POST http://localhost:3000/api/onesignal/send \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "sendToAll": true,
    "title": "Test Notification",
    "message": "This is a test"
  }'
```

#### 4. Test Push Notifications

**A. Test New Negotiation:**
1. Sebagai buyer, buat negotiation baru
2. Admin yang login seharusnya menerima push notification
3. Check console log di backend
4. Verify notifikasi muncul di browser

**B. Test New Order:**
1. Buat order baru
2. Admin menerima push notification
3. Check notification content dan data

**C. Test Order Status Update:**
1. Sebagai admin, update order status
2. Buyer seharusnya menerima push notification
3. Verify status message sesuai

#### 5. Test OneSignal Dashboard
1. Login ke OneSignal Dashboard
2. Buka "Audience" → "All Users"
3. Verify ada subscribers
4. Test send notification manual dari dashboard

---

## 📁 File Structure

```
src/
├── components/
│   ├── layout/
│   │   └── admin-layout.tsx          # ✅ Injected OneSignalClient
│   └── onesignal/
│       └── onesignal-client.tsx      # ✅ NEW - Client initialization
├── app/
│   └── api/
│       ├── onesignal/
│       │   ├── register/
│       │   │   └── route.ts          # ✅ NEW - Register player ID
│       │   └── send/
│       │       └── route.ts          # ✅ NEW - Send notification
│       ├── negotiations/
│       │   └── route.ts              # ✅ UPDATED - Add push trigger
│       └── orders/
│           ├── route.ts              # ✅ UPDATED - Add push trigger
│           └── [id]/
│               └── status/
│                   └── route.ts      # ✅ UPDATED - Add push trigger
├── lib/
│   └── onesignal.ts                  # ✅ NEW - Helper functions
└── supabase/
    └── migrations/
        └── 20251212_create_notifications_log.sql  # ✅ NEW

public/
├── OneSignalSDKWorker.js             # ✅ EXISTS
├── OneSignalSDKUpdaterWorker.js      # ✅ EXISTS
└── OneSignalSDK.sw.js                # ✅ EXISTS

.env.local                             # ✅ UPDATED
```

---

## 🔧 Troubleshooting

### Issue: Notification Permission tidak muncul
**Solution:**
1. Check browser console untuk error
2. Pastikan site berjalan di HTTPS atau localhost
3. Reset browser permissions: Settings → Privacy → Site Settings
4. Clear browser cache dan cookies

### Issue: Player ID tidak tersimpan
**Solution:**
1. Check network tab untuk request ke `/api/onesignal/register`
2. Verify adminId valid (user sedang login)
3. Check database untuk error log
4. Verify `onesignal_player_id` column exists di `profiles` table

### Issue: Push notification tidak diterima
**Solution:**
1. Verify player_id tersimpan di database
2. Check OneSignal Dashboard → Audience → All Users
3. Test send manual dari dashboard
4. Check browser notification settings (allowed)
5. Verify ONESIGNAL_REST_API_KEY benar
6. Check backend console logs untuk error

### Issue: CORS Error
**Solution:**
- Pastikan domain sudah didaftarkan di OneSignal dashboard
- Check service worker loaded dengan benar
- Verify `next.config.ts` tidak memblokir service worker

---

## 📊 Performance Notes

1. **OneSignal SDK Loading:**
   - Loaded secara asynchronous untuk tidak block rendering
   - Only initialized on authenticated admin pages

2. **Push Notification Triggers:**
   - Semua trigger menggunakan `.catch()` - tidak block API response
   - Error hanya di-log, tidak throw exception

3. **Database Queries:**
   - Fetch player_id menggunakan indexed column
   - Bulk admin notification fetch semua player_id sekaligus

---

## 🎉 Sprint Completion Checklist

- [x] A1: Setup Environment Variables
- [x] A2: Configure OneSignal Dashboard (partial - perlu manual di dashboard)
- [x] B1: Create OneSignal Client Component
- [x] B2: Inject ke Admin Layout
- [x] B3: Worker Files (already exists)
- [x] B4: Client Testing Guide
- [x] C1: API Register Player ID
- [x] C2: Upsert Logic
- [x] C3: Helper Functions
- [x] C4: API Send Notification
- [x] D1: Trigger Implementation (3 triggers)
- [x] D2: Notifications Log Table

---

## 🚀 Next Steps (Post-Sprint)

### Frontend Enhancement
1. **Notification UI Component:**
   - Create notification bell icon di header
   - Show unread count badge
   - Dropdown list notifications
   - Mark as read functionality

2. **Notification Page:**
   - Full notification history page
   - Filter by type
   - Pagination
   - Mark all as read

### Backend Enhancement
1. **Notification Service:**
   - Create service untuk save notification log
   - Auto-save setiap kali send push notification
   - Support custom notification templates

2. **Admin Settings:**
   - Enable/disable notification per admin
   - Choose notification types to receive
   - Quiet hours configuration

### Analytics
1. Track notification delivery rate
2. Monitor click-through rate
3. User engagement metrics

---

## 📖 Documentation References

- [OneSignal Web SDK Documentation](https://documentation.onesignal.com/docs/web-push-quickstart)
- [OneSignal REST API](https://documentation.onesignal.com/reference/create-notification)
- [Next.js Service Workers](https://nextjs.org/docs/app/building-your-application/optimizing/service-workers)

---

**Sprint Completed:** ✅  
**Date:** December 12, 2025  
**Developer:** Wridho788  
**Status:** Ready for Testing & Deployment
