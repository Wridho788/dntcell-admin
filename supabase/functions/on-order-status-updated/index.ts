// @ts-nocheck
// Supabase Edge Function: onOrderStatusUpdated
// Triggered when order status is updated
// Sends OneSignal notification to the user who created the order

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ONESIGNAL_APP_ID = Deno.env.get('ONESIGNAL_APP_ID')
const ONESIGNAL_API_KEY = Deno.env.get('ONESIGNAL_API_KEY')

interface OrderUpdatePayload {
  type: 'UPDATE'
  table: string
  record: {
    id: string
    user_id: string
    product_id: string
    price: number
    status: string
    admin_note: string | null
    updated_at: string
  }
  old_record: {
    status: string
  }
  schema: string
}

serve(async (req) => {
  try {
    // Parse the webhook payload
    const payload: OrderUpdatePayload = await req.json()
    
    if (payload.type !== 'UPDATE' || payload.table !== 'orders') {
      return new Response(
        JSON.stringify({ error: 'Invalid webhook type' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const { record, old_record } = payload
    
    // Only send notification if status changed
    if (old_record.status === record.status) {
      return new Response(
        JSON.stringify({ message: 'No status change, no notification needed' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Fetch product details
    const { data: product } = await supabase
      .from('products')
      .select('name')
      .eq('id', record.product_id)
      .single()

    // Fetch user's OneSignal player ID
    const { data: user } = await supabase
      .from('users')
      .select('onesignal_player_id, full_name')
      .eq('id', record.user_id)
      .single()

    if (!user?.onesignal_player_id) {
      console.log('User has no OneSignal player ID, skipping notification')
      return new Response(
        JSON.stringify({ message: 'User has no OneSignal player ID' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Prepare notification content based on status
    let heading = ''
    let content = ''

    switch (record.status) {
      case 'processing':
        heading = '⏳ Order Sedang Diproses'
        content = `Order kamu untuk produk ${product?.name || 'Unknown'} sedang diproses oleh admin.`
        break
      
      case 'completed':
        heading = '✅ Order Selesai'
        content = `Order kamu untuk produk ${product?.name || 'Unknown'} telah selesai. Terima kasih!`
        break
      
      case 'canceled':
        heading = '❌ Order Dibatalkan'
        content = `Order kamu untuk produk ${product?.name || 'Unknown'} telah dibatalkan.`
        if (record.admin_note) {
          content += `\n\nAlasan: ${record.admin_note}`
        }
        break
      
      default:
        // Don't send notification for other status changes
        return new Response(
          JSON.stringify({ message: `No notification for status: ${record.status}` }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
    }

    // Prepare OneSignal notification
    const notificationData = {
      app_id: ONESIGNAL_APP_ID,
      headings: { en: heading },
      contents: { en: content },
      data: {
        type: 'order_status_updated',
        order_id: record.id,
        product_id: record.product_id,
        status: record.status,
      },
      include_player_ids: [user.onesignal_player_id],
    }

    // Send OneSignal notification
    const oneSignalResponse = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${ONESIGNAL_API_KEY}`,
      },
      body: JSON.stringify(notificationData),
    })

    const oneSignalResult = await oneSignalResponse.json()

    if (!oneSignalResponse.ok) {
      console.error('OneSignal error:', oneSignalResult)
      throw new Error(`OneSignal API error: ${JSON.stringify(oneSignalResult)}`)
    }

    console.log('Order status notification sent successfully:', oneSignalResult)

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Order status notification sent (${record.status})`,
        oneSignalResult 
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error processing order status notification:', error)
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error.message 
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
