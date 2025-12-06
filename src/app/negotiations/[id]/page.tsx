import { Metadata } from "next"
import { NegotiationDetailClient } from "./negotiation-detail-client"

export const metadata: Metadata = {
  title: "Negotiation Details | DNT Cell Admin",
  description: "View and manage negotiation details",
}

export default function NegotiationDetailPage({
  params,
}: {
  params: { id: string }
}) {
  return <NegotiationDetailClient negotiationId={params.id} />
}
