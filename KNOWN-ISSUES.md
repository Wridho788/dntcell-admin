# Known Issues & Solutions

## Database Foreign Key Relationship Error

### Issue
```
Database error: {
  code: 'PGRST200',
  message: "Could not find a relationship between 'negotiations' and 'products' in the schema cache"
}
```

### Root Cause
PostgREST schema cache di Supabase belum mengenali foreign key relationship antara `negotiations` dan `products`, meskipun foreign key sudah didefinisikan di migration.

### When This Occurs
- Setelah menjalankan migrations baru
- Saat menggunakan Supabase client joins (`.select('*, product:products(*)')`)
- Di frontend actions yang masih menggunakan direct Supabase queries

### Solutions

#### 1. Refresh Supabase Schema Cache (Recommended)
Di Supabase Dashboard:
1. Go to Project Settings → API
2. Click "Restart PostgREST" atau tunggu auto-refresh (beberapa menit)
3. Atau jalankan query di SQL Editor:
```sql
NOTIFY pgrst, 'reload schema';
```

#### 2. Use REST API Endpoints (Best Practice)
Gunakan API endpoints yang sudah dibuat, bukan direct Supabase queries:

**❌ Old Way (Direct Supabase)**:
```typescript
const { data } = await supabase
  .from('negotiations')
  .select('*, product:products(*)')
```

**✅ New Way (REST API)**:
```typescript
import { api } from '@/lib/api-client'
const { data } = await api.getNegotiations()
```

#### 3. Avoid Complex Joins in Client
Jika harus menggunakan Supabase client, hindari complex joins:

**❌ Complex Join**:
```typescript
.select('*, product:products(id, name, price)')
```

**✅ Simple Query + Fetch Related**:
```typescript
// Get negotiations first
const { data: negotiations } = await supabase
  .from('negotiations')
  .select('*')

// Then get related products separately
const productIds = negotiations.map(n => n.product_id)
const { data: products } = await supabase
  .from('products')
  .select('*')
  .in('id', productIds)
```

### Migration Status Check

Verify foreign keys exist:
```sql
SELECT
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM 
    information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_name = 'negotiations';
```

Expected output:
```
table_name    | column_name  | foreign_table_name | foreign_column_name
------------- | ------------ | ------------------ | -------------------
negotiations  | product_id   | products          | id
negotiations  | buyer_id     | users             | id
```

### Prevention

1. **Always use REST API endpoints** untuk data fetching
2. **Avoid direct Supabase joins** di client-side code
3. **Let API layer handle complex queries** dengan proper service role
4. **Wait for schema cache refresh** setelah running migrations

### Related Files

Files yang masih menggunakan direct Supabase queries (perlu refactor):
- `src/lib/actions/negotiation-actions.ts`
- `src/lib/actions/order-actions.ts`

Files sudah menggunakan REST API (correct):
- `src/lib/api-client.ts`
- `src/app/api/negotiations/route.ts`
- `src/app/api/orders/route.ts`

### Next Steps

Frontend refactor plan:
1. Replace all `supabase.from()` calls in actions
2. Use `api.*()` methods from api-client
3. Update React Query hooks to use new API
4. Remove direct Supabase queries from client components

---

**Last Updated**: December 11, 2025  
**Status**: Temporary workaround available, full fix pending frontend refactor
