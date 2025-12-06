import { Metadata } from 'next'
import { SettingsClient } from './settings-client'

export const metadata: Metadata = {
  title: 'Settings | DNT Cell Admin',
  description: 'System settings and configuration',
}

export default function SettingsPage() {
  return <SettingsClient />
}