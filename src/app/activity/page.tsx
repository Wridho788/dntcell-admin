import { Metadata } from "next"
import { ActivityLogsClient } from "./activity-client"

export const metadata: Metadata = {
  title: "Activity Logs",
  description: "View all admin activity logs and audit trail",
}

export default function ActivityLogsPage() {
  return <ActivityLogsClient />
}
