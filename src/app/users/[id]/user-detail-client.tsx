"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { AdminLayout } from "@/components/layout"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { LoadingCard } from "@/components/ui/loading"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { toast } from "sonner"
import Link from "next/link"
import {
  ArrowLeft,
  User,
  Mail,
  Phone,
  Calendar,
  ShieldCheck,
  ShieldOff,
  Package,
  MessageSquare,
} from "lucide-react"

interface UserDetailClientProps {
  userId: string
}

export function UserDetailClient({ userId }: UserDetailClientProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [showStatusDialog, setShowStatusDialog] = useState(false)
  const [pendingStatus, setPendingStatus] = useState<boolean | null>(null)

  const { data: user, isLoading, error } = useQuery({
    queryKey: ["user", userId],
    queryFn: async () => {
      const response = await fetch(`/api/users/${userId}`)
      if (!response.ok) {
        throw new Error("Failed to fetch user")
      }
      const result = await response.json()
      return result.data
    },
    staleTime: 30000,
  })

  const updateStatusMutation = useMutation({
    mutationFn: async (isActive: boolean) => {
      const response = await fetch(`/api/users/${userId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: isActive }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to update user status")
      }

      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user", userId] })
      queryClient.invalidateQueries({ queryKey: ["users"] })
      toast.success("Status pengguna berhasil diperbarui")
      setShowStatusDialog(false)
      setPendingStatus(null)
    },
    onError: (error: Error) => {
      toast.error(`Gagal memperbarui status: ${error.message}`)
    },
  })

  const handleStatusChange = (newStatus: boolean) => {
    setPendingStatus(newStatus)
    setShowStatusDialog(true)
  }

  const confirmStatusChange = () => {
    if (pendingStatus !== null) {
      updateStatusMutation.mutate(pendingStatus)
    }
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString("id-ID", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="space-y-6 mx-4">
          <LoadingCard />
        </div>
      </AdminLayout>
    )
  }

  if (error || !user) {
    return (
      <AdminLayout>
        <div className="space-y-6 mx-4">
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-red-500">
                Error loading user: {error instanceof Error ? error.message : "User not found"}
              </p>
            </CardContent>
          </Card>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      <div className="space-y-6 mx-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/users">
              <Button variant="outline" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Detail Pengguna</h1>
              <p className="text-muted-foreground">
                Informasi lengkap pengguna
              </p>
            </div>
          </div>

          {/* Status Actions */}
          <div className="flex gap-2">
            {user.is_active ? (
              <Button
                variant="destructive"
                onClick={() => handleStatusChange(false)}
                disabled={updateStatusMutation.isPending}
              >
                <ShieldOff className="mr-2 h-4 w-4" />
                Nonaktifkan
              </Button>
            ) : (
              <Button
                variant="default"
                onClick={() => handleStatusChange(true)}
                disabled={updateStatusMutation.isPending}
              >
                <ShieldCheck className="mr-2 h-4 w-4" />
                Aktifkan
              </Button>
            )}
          </div>
        </div>

        {/* User Info Grid */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle>Informasi Dasar</CardTitle>
              <CardDescription>Data personal pengguna</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <User className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Nama Lengkap</p>
                  <p className="text-sm text-muted-foreground">
                    {user.full_name || "Belum diisi"}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Mail className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Email</p>
                  <p className="text-sm text-muted-foreground">
                    {user.email || "Belum diisi"}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Phone className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Nomor Telepon</p>
                  <p className="text-sm text-muted-foreground">
                    {user.phone || "Belum diisi"}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Bergabung</p>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(user.created_at)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Account Status */}
          <Card>
            <CardHeader>
              <CardTitle>Status Akun</CardTitle>
              <CardDescription>Role dan status pengguna</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium mb-2">Role</p>
                <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                  {user.role}
                </Badge>
              </div>

              <div>
                <p className="text-sm font-medium mb-2">Status</p>
                <Badge
                  variant={user.is_active ? "default" : "secondary"}
                  className={
                    user.is_active
                      ? "bg-green-100 text-green-800"
                      : "bg-gray-100 text-gray-800"
                  }
                >
                  {user.is_active ? "Aktif" : "Tidak Aktif"}
                </Badge>
              </div>

              <div className="pt-4 border-t">
                <p className="text-sm text-muted-foreground">
                  ⚠️ <strong>Catatan:</strong> Admin tidak dapat mengubah email,
                  password, atau data sensitif lainnya demi keamanan sistem.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Activity Summary */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle>Total Pesanan</CardTitle>
                <CardDescription>Jumlah order yang dibuat</CardDescription>
              </div>
              <Package className="h-8 w-8 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold">{user._count?.orders || 0}</div>
              <Link href={`/orders?buyer_id=${userId}`}>
                <Button variant="link" className="px-0 mt-2">
                  Lihat semua pesanan →
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle>Total Negosiasi</CardTitle>
                <CardDescription>Jumlah negosiasi yang dibuat</CardDescription>
              </div>
              <MessageSquare className="h-8 w-8 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold">
                {user._count?.negotiations || 0}
              </div>
              <Link href={`/negotiations?buyer_id=${userId}`}>
                <Button variant="link" className="px-0 mt-2">
                  Lihat semua negosiasi →
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Confirmation Dialog */}
        <AlertDialog open={showStatusDialog} onOpenChange={setShowStatusDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Konfirmasi Perubahan Status
              </AlertDialogTitle>
              <AlertDialogDescription>
                Apakah Anda yakin ingin {pendingStatus ? "mengaktifkan" : "menonaktifkan"} pengguna ini?
                {!pendingStatus && (
                  <span className="block mt-2 text-red-600 font-medium">
                    Pengguna yang dinonaktifkan tidak akan dapat mengakses sistem.
                  </span>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Batal</AlertDialogCancel>
              <AlertDialogAction onClick={confirmStatusChange}>
                Ya, Lanjutkan
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AdminLayout>
  )
}
