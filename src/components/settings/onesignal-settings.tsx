"use client"

import { useState } from "react"
import { useMutation } from "@tanstack/react-query"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { Bell, Send, Save } from "lucide-react"

export function OneSignalSettings() {
  const [appId, setAppId] = useState("")
  const [apiKey, setApiKey] = useState("")

  const saveSettingsMutation = useMutation({
    mutationFn: async () => {
      // Save to environment or database
      const response = await fetch("/api/settings/onesignal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appId, apiKey }),
      })

      if (!response.ok) {
        throw new Error("Failed to save settings")
      }

      return response.json()
    },
    onSuccess: () => {
      toast.success("OneSignal settings saved successfully!")
    },
    onError: (error: Error) => {
      toast.error(`Failed to save settings: ${error.message}`)
    },
  })

  const testNotificationMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/settings/onesignal/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appId, apiKey }),
      })

      if (!response.ok) {
        throw new Error("Failed to send test notification")
      }

      return response.json()
    },
    onSuccess: () => {
      toast.success("Test notification sent successfully!")
    },
    onError: (error: Error) => {
      toast.error(`Failed to send test notification: ${error.message}`)
    },
  })

  const handleSave = () => {
    if (!appId || !apiKey) {
      toast.error("Please fill in all fields")
      return
    }
    saveSettingsMutation.mutate()
  }

  const handleTestNotification = () => {
    if (!appId || !apiKey) {
      toast.error("Please fill in all fields before testing")
      return
    }
    testNotificationMutation.mutate()
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            <CardTitle>OneSignal Configuration</CardTitle>
          </div>
          <Badge variant="outline">Push Notifications</Badge>
        </div>
        <CardDescription>
          Configure OneSignal for push notifications to admins and users
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Configuration Form */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="onesignal-app-id">OneSignal App ID</Label>
            <Input
              id="onesignal-app-id"
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              value={appId}
              onChange={(e) => setAppId(e.target.value)}
            />
            <p className="text-sm text-muted-foreground">
              Your OneSignal Application ID from the dashboard
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="onesignal-api-key">OneSignal REST API Key</Label>
            <Input
              id="onesignal-api-key"
              type="password"
              placeholder="Enter your REST API key"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
            <p className="text-sm text-muted-foreground">
              Your OneSignal REST API Key (keep this secure)
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <Button
            onClick={handleSave}
            disabled={saveSettingsMutation.isPending}
          >
            <Save className="h-4 w-4 mr-2" />
            {saveSettingsMutation.isPending ? "Saving..." : "Save Settings"}
          </Button>

          <Button
            variant="outline"
            onClick={handleTestNotification}
            disabled={testNotificationMutation.isPending || !appId || !apiKey}
          >
            <Send className="h-4 w-4 mr-2" />
            {testNotificationMutation.isPending ? "Sending..." : "Test Notification"}
          </Button>
        </div>

        {/* Setup Instructions */}
        <div className="rounded-lg bg-muted p-4 space-y-2">
          <h4 className="font-medium">Setup Instructions:</h4>
          <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
            <li>Create an account at <a href="https://onesignal.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">OneSignal.com</a></li>
            <li>Create a new app for your platform (Web, iOS, Android)</li>
            <li>Copy your App ID from Settings → Keys & IDs</li>
            <li>Generate a REST API Key from Settings → Keys & IDs</li>
            <li>Paste the credentials above and click Save Settings</li>
            <li>Use Test Notification to verify the configuration</li>
          </ol>
        </div>

        {/* Features List */}
        <div className="border-t pt-4">
          <h4 className="font-medium mb-3">Notification Features:</h4>
          <div className="grid gap-2 text-sm">
            <div className="flex items-start gap-2">
              <Bell className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div>
                <div className="font-medium">New Negotiation Alert</div>
                <div className="text-muted-foreground">
                  Admins receive notifications when buyers submit price offers
                </div>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Bell className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div>
                <div className="font-medium">Negotiation Status Update</div>
                <div className="text-muted-foreground">
                  Users receive notifications when offers are approved/rejected
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
