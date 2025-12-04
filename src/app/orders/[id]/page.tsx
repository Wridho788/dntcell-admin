import { Metadata } from "next"
import { OrderDetailClient } from "./order-detail-client"

export const metadata: Metadata = {
  title: "Order Details | DNT Cell Admin",
  description: "View and manage order details",
}

export default function OrderDetailPage({
  params,
}: {
  params: { id: string }
}) {
  return <OrderDetailClient orderId={params.id} />
}
