# Database Migration - Fix Location Field

## Masalah
Database error: `invalid input syntax for type uuid: "Medan"` karena kolom `location_id` di database mengharapkan UUID, tapi kita mengirim string.

## Solusi
Mengubah `location_id` (UUID) menjadi `location` (VARCHAR) untuk penyimpanan langsung nama kota.

## Langkah Migrasi

### 1. Jalankan Migration SQL
Buka Supabase Dashboard → SQL Editor dan jalankan:

```sql
-- Migration: Change location_id to location (string)
ALTER TABLE products 
ADD COLUMN location VARCHAR(100);

-- Update existing data (if any)
UPDATE products 
SET location = 'Jakarta' 
WHERE location_id IS NOT NULL;

-- Drop the old location_id column  
ALTER TABLE products 
DROP COLUMN location_id;

-- Make location NOT NULL
ALTER TABLE products 
ALTER COLUMN location SET NOT NULL;
```

### 2. Atau Jalankan Complete Setup
Jika belum ada data penting, lebih mudah jalankan `complete-database-setup.sql` yang sudah diperbaiki.

### 3. Verifikasi
Setelah migration, struktur table `products` akan berubah dari:
```
location_id UUID → location VARCHAR(100) NOT NULL
```

## Files yang Diperbaiki
- ✅ `src/lib/validations/product.ts` - Schema validation
- ✅ `src/components/products/product-form.tsx` - Form fields  
- ✅ `complete-database-setup.sql` - Database setup
- ✅ `migration-location-fix.sql` - Migration script

## Test Setelah Migration
1. Coba create product lagi dengan location "Medan"
2. Check console untuk debug logs
3. Verify data tersimpan di database dengan benar

Masalah UUID akan teratasi dan create product akan berhasil! 🎉