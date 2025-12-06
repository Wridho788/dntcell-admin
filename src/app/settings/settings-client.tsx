"use client"

import { OneSignalSettings } from "@/components/settings/onesignal-settings"

export function SettingsClient() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage system configuration and preferences
        </p>
      </div>

      {/* OneSignal Configuration */}
      <OneSignalSettings />
    </div>
  )
}
