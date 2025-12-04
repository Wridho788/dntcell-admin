import { Metadata } from 'next'
import { AdminLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Settings, Save, RefreshCw, Database, Shield, Bell } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Settings',
  description: 'System settings and configuration',
}

export default function SettingsPage() {
  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">
            Manage system configuration and preferences
          </p>
        </div>

        {/* General Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              General Settings
            </CardTitle>
            <CardDescription>
              Basic system configuration and preferences
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="app-name">Application Name</Label>
                <Input id="app-name" defaultValue="DNTCELL Admin Panel" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="app-url">Application URL</Label>
                <Input id="app-url" defaultValue="https://admin.dntcell.com" />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="description">System Description</Label>
              <Textarea 
                id="description" 
                defaultValue="Admin panel for DNTCELL management system"
                rows={3}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Switch id="maintenance-mode" />
              <Label htmlFor="maintenance-mode">Maintenance Mode</Label>
            </div>
          </CardContent>
        </Card>

        {/* Database Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Database Configuration
            </CardTitle>
            <CardDescription>
              Database connection and backup settings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="db-host">Database Host</Label>
                <Input id="db-host" defaultValue="localhost" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="db-port">Port</Label>
                <Input id="db-port" defaultValue="5432" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="db-name">Database Name</Label>
              <Input id="db-name" defaultValue="dntcell_admin" />
            </div>

            <div className="flex items-center space-x-2">
              <Switch id="auto-backup" defaultChecked />
              <Label htmlFor="auto-backup">Enable Automatic Backups</Label>
            </div>

            <Button variant="outline">
              <RefreshCw className="mr-2 h-4 w-4" />
              Test Connection
            </Button>
          </CardContent>
        </Card>

        {/* Security Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Security Settings
            </CardTitle>
            <CardDescription>
              Authentication and security configuration
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="session-timeout">Session Timeout (minutes)</Label>
                <Input id="session-timeout" defaultValue="60" type="number" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="max-attempts">Max Login Attempts</Label>
                <Input id="max-attempts" defaultValue="5" type="number" />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Switch id="two-factor" />
                <Label htmlFor="two-factor">Require Two-Factor Authentication</Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Switch id="password-policy" defaultChecked />
                <Label htmlFor="password-policy">Enforce Strong Password Policy</Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Switch id="ip-whitelist" />
                <Label htmlFor="ip-whitelist">Enable IP Whitelist</Label>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notification Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notifications
            </CardTitle>
            <CardDescription>
              Configure system notifications and alerts
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Switch id="email-notifications" defaultChecked />
                <Label htmlFor="email-notifications">Email Notifications</Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Switch id="security-alerts" defaultChecked />
                <Label htmlFor="security-alerts">Security Alerts</Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Switch id="system-updates" />
                <Label htmlFor="system-updates">System Update Notifications</Label>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="admin-email">Administrator Email</Label>
              <Input id="admin-email" defaultValue="admin@dntcell.com" type="email" />
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button size="lg">
            <Save className="mr-2 h-4 w-4" />
            Save Settings
          </Button>
        </div>
      </div>
    </AdminLayout>
  )
}