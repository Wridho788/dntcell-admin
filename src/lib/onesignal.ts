/**
 * OneSignal Helper Functions
 * Handles sending push notifications via OneSignal REST API
 */

const ONESIGNAL_APP_ID = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID!
const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY!

export interface SendNotificationParams {
  playerIds: string[]
  title: string
  message: string
  data?: Record<string, any>
  url?: string
}

export interface SendNotificationResult {
  success: boolean
  id?: string
  recipients?: number
  error?: string
}

/**
 * Send push notification to specific player IDs
 */
export async function sendPushNotification(
  params: SendNotificationParams
): Promise<SendNotificationResult> {
  try {
    if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
      console.error('[OneSignal] Missing API credentials')
      return {
        success: false,
        error: 'OneSignal API credentials not configured',
      }
    }

    const { playerIds, title, message, data, url } = params

    if (!playerIds || playerIds.length === 0) {
      return {
        success: false,
        error: 'No player IDs provided',
      }
    }

    // Prepare notification payload
    const payload: any = {
      app_id: ONESIGNAL_APP_ID,
      include_player_ids: playerIds,
      headings: {
        en: title,
      },
      contents: {
        en: message,
      },
    }

    // Add custom data if provided
    if (data) {
      payload.data = data
    }

    // Add URL if provided
    if (url) {
      payload.url = url
    }

    // Send notification via OneSignal REST API
    const response = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${ONESIGNAL_REST_API_KEY}`,
      },
      body: JSON.stringify(payload),
    })

    const result = await response.json()

    if (!response.ok) {
      console.error('[OneSignal] API Error:', result)
      return {
        success: false,
        error: result.errors?.[0] || 'Failed to send notification',
      }
    }

    console.log('[OneSignal] Notification sent:', {
      id: result.id,
      recipients: result.recipients,
    })

    return {
      success: true,
      id: result.id,
      recipients: result.recipients,
    }
  } catch (error) {
    console.error('[OneSignal] Send notification error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Send notification to admin user by user ID
 * Fetches player ID from database first
 */
export async function sendAdminNotification(
  adminId: string,
  title: string,
  message: string,
  data?: Record<string, any>,
  url?: string
): Promise<SendNotificationResult> {
  try {
    // Import supabase client
    const { supabaseAdmin } = await import('@/api/_core/supabase-server')

    // Get admin's player ID from database
    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('onesignal_player_id, role')
      .eq('user_id', adminId)
      .single()

    if (error || !profile) {
      console.error('[OneSignal] Admin not found:', adminId)
      return {
        success: false,
        error: 'Admin not found',
      }
    }

    if (!profile.onesignal_player_id) {
      console.warn('[OneSignal] Admin has no player ID:', adminId)
      return {
        success: false,
        error: 'Admin has not enabled push notifications',
      }
    }

    // Send notification
    return sendPushNotification({
      playerIds: [profile.onesignal_player_id],
      title,
      message,
      data,
      url,
    })
  } catch (error) {
    console.error('[OneSignal] sendAdminNotification error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Send notification to multiple admins
 */
export async function sendBulkAdminNotification(
  title: string,
  message: string,
  data?: Record<string, any>,
  url?: string
): Promise<SendNotificationResult> {
  try {
    const { supabaseAdmin } = await import('@/api/_core/supabase-server')

    // Get all admins with player IDs
    const { data: admins, error } = await supabaseAdmin
      .from('profiles')
      .select('onesignal_player_id')
      .eq('role', 'admin')
      .not('onesignal_player_id', 'is', null)

    if (error || !admins || admins.length === 0) {
      console.warn('[OneSignal] No admins with player IDs found')
      return {
        success: false,
        error: 'No admins available for notification',
      }
    }

    const playerIds = admins
      .map((admin) => admin.onesignal_player_id)
      .filter((id): id is string => !!id)

    if (playerIds.length === 0) {
      return {
        success: false,
        error: 'No valid player IDs found',
      }
    }

    // Send notification to all admins
    return sendPushNotification({
      playerIds,
      title,
      message,
      data,
      url,
    })
  } catch (error) {
    console.error('[OneSignal] sendBulkAdminNotification error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
