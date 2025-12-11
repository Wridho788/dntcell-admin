import { supabaseAdmin } from './supabase-server'

export interface ActivityLogData {
  admin_id: string
  action: string
  meta?: Record<string, any>
}

export async function logActivity(data: ActivityLogData) {
  try {
    await supabaseAdmin
      .from('activity_logs')
      .insert({
        admin_id: data.admin_id,
        action: data.action,
        meta: data.meta || {},
        created_at: new Date().toISOString(),
      })
  } catch (error) {
    console.error('Failed to log activity:', error)
  }
}
