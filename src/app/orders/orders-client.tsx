"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { searchOrders } from "@/lib/actions";
import {
  type OrderWithDetails,
  type OrderStatus,
  type PaymentStatus,
  type PaymentMethod,
} from "@/lib/validations/order";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LoadingCard } from "@/components/ui/loading";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { Eye, Package, DollarSign, Search } from "lucide-react";
import { AdminLayout } from "@/components/layout";

const orderStatusColors: Record<OrderStatus, string> = {
  pending: "bg-yellow-500",
  processing: "bg-blue-500",
  completed: "bg-green-500",
  canceled: "bg-red-500",
};

const paymentStatusColors: Record<PaymentStatus, string> = {
  pending: "bg-yellow-500",
  paid: "bg-green-500",
  failed: "bg-red-500",
};

export function OrdersClient() {
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<
    PaymentStatus | "all"
  >("all");
  const [orderStatusFilter, setOrderStatusFilter] = useState<
    OrderStatus | "all"
  >("all");
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<
    PaymentMethod | "all"
  >("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const limit = 10;

  const { data, isLoading, error } = useQuery({
    queryKey: [
      "orders",
      {
        page,
        limit,
        paymentStatus:
          paymentStatusFilter !== "all" ? paymentStatusFilter : undefined,
        orderStatus:
          orderStatusFilter !== "all" ? orderStatusFilter : undefined,
        paymentMethod:
          paymentMethodFilter !== "all" ? paymentMethodFilter : undefined,
        searchQuery: searchQuery || undefined,
      },
    ],
    queryFn: async () => {
      const result = await searchOrders({
        page,
        limit,
        payment_status:
          paymentStatusFilter !== "all" ? paymentStatusFilter : undefined,
        order_status:
          orderStatusFilter !== "all" ? orderStatusFilter : undefined,
        payment_method:
          paymentMethodFilter !== "all" ? paymentMethodFilter : undefined,
        search: searchQuery || undefined,
        sort_by: "created_at",
        sort_order: "desc",
      });

      if (!result.success || !result.data) {
        throw new Error(result.error || "Failed to fetch orders");
      }

      return result.data;
    },
    staleTime: 30000,
  });

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(price);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("id-ID", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const totalPages = data ? Math.ceil(data.total / limit) : 0;

  // Calculate stats
  const stats = {
    total: data?.total || 0,
    pending:
      data?.orders.filter((o) => o.order_status === "pending").length || 0,
    processing:
      data?.orders.filter((o) => o.order_status === "processing").length || 0,
    completed:
      data?.orders.filter((o) => o.order_status === "completed").length || 0,
    unpaidAmount:
      data?.orders
        .filter((o) => o.payment_status === "pending")
        .reduce((sum, o) => sum + o.final_price, 0) || 0,
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <LoadingCard />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-red-500">
            Error loading orders: {error.message}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6 mx-4">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Manajemen Pesanan
          </h1>
          <p className="text-muted-foreground">
            Kelola pesanan dan lacak transaksi
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Pesanan
              </CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Tertunda</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">
                {stats.pending}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Diproses</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {stats.processing}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Belum Dibayar
              </CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {formatPrice(stats.unpaidAmount)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Cari & Filter</CardTitle>
            <CardDescription>
              Cari berdasarkan ID Order atau nama produk, dan filter berdasarkan status
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Cari berdasarkan ID Order atau nama produk..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setPage(1);
                  }}
                  className="pl-9"
                />
              </div>

              {/* Filter Row */}
              <div className="flex flex-wrap gap-4">
                <div className="flex-1 min-w-[200px]">
                  <label className="text-sm font-medium mb-2 block">
                    Status Pesanan
                  </label>
                  <Select
                    value={orderStatusFilter}
                    onValueChange={(value) => {
                      setOrderStatusFilter(value as OrderStatus | "all");
                      setPage(1);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Semua status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua Status</SelectItem>
                      <SelectItem value="pending">Tertunda</SelectItem>
                      <SelectItem value="processing">Diproses</SelectItem>
                      <SelectItem value="completed">Selesai</SelectItem>
                      <SelectItem value="canceled">Dibatalkan</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex-1 min-w-[200px]">
                  <label className="text-sm font-medium mb-2 block">
                    Status Pembayaran
                  </label>
                  <Select
                    value={paymentStatusFilter}
                    onValueChange={(value) => {
                      setPaymentStatusFilter(value as PaymentStatus | "all");
                      setPage(1);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Semua pembayaran" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua Pembayaran</SelectItem>
                      <SelectItem value="pending">Tertunda</SelectItem>
                      <SelectItem value="paid">Lunas</SelectItem>
                      <SelectItem value="failed">Gagal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex-1 min-w-[200px]">
                  <label className="text-sm font-medium mb-2 block">
                    Metode Pembayaran
                  </label>
                  <Select
                    value={paymentMethodFilter}
                    onValueChange={(value) => {
                      setPaymentMethodFilter(value as PaymentMethod | "all");
                      setPage(1);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Semua metode" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua Metode</SelectItem>
                      <SelectItem value="transfer">Transfer</SelectItem>
                      <SelectItem value="cod">Bayar di Tempat</SelectItem>
                      <SelectItem value="ewallet">E-Wallet</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Orders Table */}
        <Card>
          <CardHeader>
            <CardTitle>Pesanan ({data?.total || 0})</CardTitle>
          </CardHeader>
          <CardContent>
            {data?.orders.length === 0 ? (
              <div className="text-center py-12">
                <Package className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-semibold">
                  Tidak ada pesanan
                </h3>
                <p className="text-muted-foreground mt-2">
                  Tidak ada pesanan yang cocok dengan filter saat ini.
                </p>
              </div>
            ) : (
              <>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID Pesanan</TableHead>
                        <TableHead>Produk</TableHead>
                        <TableHead>Pembeli</TableHead>
                        <TableHead>Harga Final</TableHead>
                        <TableHead>Pembayaran</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Tanggal</TableHead>
                        <TableHead className="text-right">Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data?.orders.map((order: OrderWithDetails) => (
                        <TableRow key={order.id}>
                          <TableCell className="font-mono text-sm">
                            {order.id.slice(0, 8)}
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">
                              {order.product?.name}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <div className="font-medium">
                                {order.buyer?.full_name || "Unknown"}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {order.buyer?.email}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="font-semibold">
                            {formatPrice(order.final_price)}
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <Badge
                                className={
                                  paymentStatusColors[order.payment_status]
                                }
                              >
                                {order.payment_status}
                              </Badge>
                              <div className="text-xs text-muted-foreground">
                                {order.payment_method.replace("_", " ")}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              className={orderStatusColors[order.order_status]}
                            >
                              {order.order_status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">
                            {formatDate(order.created_at)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Link href={`/orders/${order.id}`}>
                              <Button variant="ghost" size="sm">
                                <Eye className="h-4 w-4" />
                              </Button>
                            </Link>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4">
                    <div className="text-sm text-muted-foreground">
                      Halaman {page} dari {totalPages}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                      >
                        Sebelumnya
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setPage((p) => Math.min(totalPages, p + 1))
                        }
                        disabled={page === totalPages}
                      >
                        Selanjutnya
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
