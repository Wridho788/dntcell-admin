import { Metadata } from "next"
import { NegotiationsClient } from "./negotiations-client"

export const metadata: Metadata = {
  title: "Negotiations | DNT Cell Admin",
  description: "Manage price negotiations",
}

export default function NegotiationsPage() {
  return <NegotiationsClient />
}
