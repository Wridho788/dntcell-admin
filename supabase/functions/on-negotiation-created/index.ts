// @ts-nocheck
// Supabase Edge Function: onNegotiationCreated
// Triggered when a new negotiation is created
// Sends OneSignal notification to all admin devices

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ONESIGNAL_APP_ID = Deno.env.get('ONESIGNAL_APP_ID')
const ONESIGNAL_API_KEY = Deno.env.get('ONESIGNAL_API_KEY')

interface NegotiationPayload {
  type: 'INSERT'
  table: string
  record: {
    id: string
    product_id: string
    user_id: string
    offer_price: number
    created_at: string
  }
  schema: string
}

serve(async (req) => {
  try {
    // Parse the webhook payload
    const payload: NegotiationPayload = await req.json()
    
    if (payload.type !== 'INSERT' || payload.table !== 'negotiations') {
      return new Response(
        JSON.stringify({ error: 'Invalid webhook type' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const { record } = payload
    
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

    // Fetch user details
    const { data: user } = await supabase
      .from('users')
      .select('full_name, email')
      .eq('id', record.user_id)
      .single()

    // Format offer price
    const offerPrice = new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(record.offer_price)

    // Prepare OneSignal notification
    const notificationData = {
      app_id: ONESIGNAL_APP_ID,
      headings: { en: '🔔 Negosiasi Harga Baru!' },
      contents: {
        en: `Produk: ${product?.name || 'Unknown Product'}\nDari: ${user?.full_name || user?.email || 'Unknown User'}\nHarga Tawaran: ${offerPrice}`
      },
      data: {
        type: 'negotiation_created',
        negotiation_id: record.id,
        product_id: record.product_id,
      },
      // Send to all users with role = 'admin'
      filters: [
        { field: 'tag', key: 'user_role', relation: '=', value: 'admin' }
      ],
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

    console.log('Notification sent successfully:', oneSignalResult)

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Notification sent to admins',
        oneSignalResult 
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error processing negotiation notification:', error)
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error.message 
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
