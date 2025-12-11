-- Add onesignal_player_id column to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS onesignal_player_id TEXT;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_onesignal_player_id 
ON profiles(onesignal_player_id);

-- Add comment
COMMENT ON COLUMN profiles.onesignal_player_id IS 'OneSignal player ID for push notifications';
