-- Migration: Create Notifications Log Table
-- Date: 2025-12-12
-- Purpose: Create table for storing notification history in admin panel

-- Create notifications_log table for admin panel UI
CREATE TABLE IF NOT EXISTS notifications_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(user_id) ON DELETE CASCADE,
  admin_id UUID REFERENCES profiles(user_id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL,
  data JSONB DEFAULT '{}'::jsonb,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  
  -- Constraints
  CONSTRAINT valid_notification_type CHECK (
    type IN (
      'new_negotiation',
      'negotiation_approved', 
      'negotiation_rejected',
      'new_order',
      'order_status_updated',
      'system_message'
    )
  )
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_notifications_log_user_id 
  ON notifications_log(user_id);

CREATE INDEX IF NOT EXISTS idx_notifications_log_admin_id 
  ON notifications_log(admin_id);

CREATE INDEX IF NOT EXISTS idx_notifications_log_type 
  ON notifications_log(type);

CREATE INDEX IF NOT EXISTS idx_notifications_log_read_at 
  ON notifications_log(read_at);

CREATE INDEX IF NOT EXISTS idx_notifications_log_created_at 
  ON notifications_log(created_at DESC);

-- Enable RLS
ALTER TABLE notifications_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies for notifications_log
-- Users can view their own notifications
CREATE POLICY "Users can view their own notifications"
  ON notifications_log FOR SELECT
  USING (auth.uid() = user_id);

-- Admins can view all notifications
CREATE POLICY "Admins can view all notifications"
  ON notifications_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- System can insert notifications
CREATE POLICY "System can insert notifications"
  ON notifications_log FOR INSERT
  WITH CHECK (true);

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can mark their own notifications as read"
  ON notifications_log FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Add comments
COMMENT ON TABLE notifications_log IS 'Notification history log for admin panel UI';
COMMENT ON COLUMN notifications_log.user_id IS 'Recipient user ID';
COMMENT ON COLUMN notifications_log.admin_id IS 'Admin who triggered the notification (if applicable)';
COMMENT ON COLUMN notifications_log.type IS 'Type of notification (new_negotiation, new_order, etc.)';
COMMENT ON COLUMN notifications_log.data IS 'Additional notification metadata';
COMMENT ON COLUMN notifications_log.read_at IS 'Timestamp when notification was read';
