import { Metadata } from "next"
import { OrdersClient } from "./orders-client"

export const metadata: Metadata = {
  title: "Order Management | DNT Cell Admin",
  description: "Manage orders and transactions",
}

export default function OrdersPage() {
  return <OrdersClient />
}
