// @ts-nocheck
// Supabase Edge Function: onNegotiationUpdated
// Triggered when negotiation status is updated (approved/rejected)
// Sends OneSignal notification to the user who created the negotiation

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ONESIGNAL_APP_ID = Deno.env.get('ONESIGNAL_APP_ID')
const ONESIGNAL_API_KEY = Deno.env.get('ONESIGNAL_API_KEY')

interface NegotiationUpdatePayload {
  type: 'UPDATE'
  table: string
  record: {
    id: string
    product_id: string
    user_id: string
    offer_price: number
    final_price?: number
    status: string
    note?: string
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
    const payload: NegotiationUpdatePayload = await req.json()
    
    if (payload.type !== 'UPDATE' || payload.table !== 'negotiations') {
      return new Response(
        JSON.stringify({ error: 'Invalid webhook type' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const { record, old_record } = payload
    
    // Only send notification if status changed to approved or rejected
    if (
      old_record.status === record.status ||
      (record.status !== 'approved' && record.status !== 'rejected')
    ) {
      return new Response(
        JSON.stringify({ message: 'No notification needed' }),
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

    if (record.status === 'approved') {
      const finalPrice = new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
      }).format(record.final_price || record.offer_price)

      heading = '✅ Negosiasi Disetujui!'
      content = `Produk: ${product?.name || 'Unknown'}\nHarga Final: ${finalPrice}\n\nSilakan lanjutkan ke pembayaran.`
    } else if (record.status === 'rejected') {
      heading = '❌ Negosiasi Ditolak'
      content = `Produk: ${product?.name || 'Unknown'}\n${record.note ? `Alasan: ${record.note}` : 'Silakan ajukan negosiasi baru.'}`
    }

    // Prepare OneSignal notification
    const notificationData = {
      app_id: ONESIGNAL_APP_ID,
      headings: { en: heading },
      contents: { en: content },
      data: {
        type: 'negotiation_updated',
        negotiation_id: record.id,
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

    console.log('Notification sent successfully:', oneSignalResult)

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Notification sent to user (${record.status})`,
        oneSignalResult 
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error processing negotiation update notification:', error)
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error.message 
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
