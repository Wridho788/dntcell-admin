'use client'

import { AdminLayout } from '@/components/layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, Activity, TrendingUp, DollarSign } from 'lucide-react'

const stats = [
  {
    title: 'Total Pengguna',
    value: '1,234',
    description: '+20% dari bulan lalu',
    icon: Users,
  },
  {
    title: 'Sesi Aktif',
    value: '456',
    description: '+12% dari bulan lalu',
    icon: Activity,
  },
  {
    title: 'Tingkat Pertumbuhan',
    value: '23.5%',
    description: '+2.1% dari bulan lalu',
    icon: TrendingUp,
  },
  {
    title: 'Pendapatan',
    value: 'Rp 12.345.000',
    description: '+8% dari bulan lalu',
    icon: DollarSign,
  },
]

export function DashboardClient() {
  return (
    <AdminLayout>
      <div className="page-container">
        {/* Header */}
        <div className="page-header">
          <h1 className="page-title">Dashboard</h1>
          <p className="page-description">
            Selamat datang di dashboard admin. Berikut yang terjadi hari ini.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 md:gap-6 md:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => {
            const Icon = stat.icon
            return (
              <Card key={stat.title}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    {stat.title}
                  </CardTitle>
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stat.value}</div>
                  <p className="text-xs text-muted-foreground">
                    {stat.description}
                  </p>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* Recent Activity */}
        <div className="section-spacing">
          <div className="grid gap-4 md:gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Aktivitas Terbaru</CardTitle>
                <CardDescription>
                  Aktivitas sistem dan aksi pengguna terbaru
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                <div className="flex items-center space-x-4">
                  <div className="w-2 h-2 bg-green-500 rounded-full" />
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-medium">Pengguna baru terdaftar</p>
                    <p className="text-xs text-muted-foreground">2 menit yang lalu</p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="w-2 h-2 bg-blue-500 rounded-full" />
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-medium">Backup database selesai</p>
                    <p className="text-xs text-muted-foreground">15 menit yang lalu</p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="w-2 h-2 bg-yellow-500 rounded-full" />
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-medium">Update sistem tersedia</p>
                    <p className="text-xs text-muted-foreground">1 jam yang lalu</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Status Sistem</CardTitle>
              <CardDescription>
                Kesehatan sistem dan metrik performa saat ini
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Waktu Respons API</span>
                  <span className="text-sm text-green-600">145ms</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Status Database</span>
                  <span className="text-sm text-green-600">Sehat</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Uptime Server</span>
                  <span className="text-sm text-green-600">99.9%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Koneksi Aktif</span>
                  <span className="text-sm text-blue-600">234</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        </div>
      </div>
    </AdminLayout>
  )
}