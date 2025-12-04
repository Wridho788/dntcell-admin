/**
 * One-time script to fix products with temp/ URLs
 * Run this to migrate existing products to use correct image URLs
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

async function fixTempUrls() {
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  // Get all products with temp/ URLs
  const { data: products, error } = await supabase
    .from('products')
    .select('id, main_image_url')
    .like('main_image_url', '%/temp/%')

  if (error) {
    console.error('Error fetching products:', error)
    return
  }

  console.log(`Found ${products?.length || 0} products with temp/ URLs`)

  for (const product of products || []) {
    try {
      const oldUrl = product.main_image_url
      if (!oldUrl) continue

      // Extract filename from temp URL
      const urlParts = oldUrl.split('/temp/')
      if (urlParts.length !== 2) continue

      const filename = urlParts[1]
      const newPath = `${product.id}/${filename}`

      // Check if file exists in product folder
      const { data: fileExists } = await supabase.storage
        .from('product-images')
        .list(product.id, {
          search: filename
        })

      if (!fileExists || fileExists.length === 0) {
        console.log(`⚠️ File not found in product folder: ${newPath}`)
        console.log(`   Skipping product ${product.id}`)
        continue
      }

      // Get new public URL
      const { data: urlData } = supabase.storage
        .from('product-images')
        .getPublicUrl(newPath)

      // Update product
      const { error: updateError } = await supabase
        .from('products')
        .update({ main_image_url: urlData.publicUrl })
        .eq('id', product.id)

      if (updateError) {
        console.error(`❌ Error updating product ${product.id}:`, updateError)
      } else {
        console.log(`✅ Fixed product ${product.id}`)
        console.log(`   Old: ${oldUrl}`)
        console.log(`   New: ${urlData.publicUrl}`)
      }
    } catch (error) {
      console.error(`❌ Error processing product ${product.id}:`, error)
    }
  }

  console.log('✅ Migration complete!')
}

fixTempUrls().catch(console.error)
