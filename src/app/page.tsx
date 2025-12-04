import { redirect } from 'next/navigation'
import { getCurrentUser, isUserAdmin } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import { ArrowRight, Shield, Users, BarChart3 } from 'lucide-react'

export default async function Home() {
  // Check if user is authenticated
  const user = await getCurrentUser()
  
  if (user) {
    // Redirect authenticated users to dashboard
    redirect('/dashboard')
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-background to-muted">
      <div className="container mx-auto px-4 py-16">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-6xl font-bold mb-6 bg-linear-to-r from-primary to-blue-600 bg-clip-text text-transparent">
            DNTCELL Admin Panel
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Powerful admin dashboard for managing your DNTCELL platform. 
            Secure, efficient, and built for administrators.
          </p>
          <div className="flex justify-center gap-4">
            <Button asChild size="lg">
              <Link href="/login">
                Access Admin Panel
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          <Card>
            <CardHeader>
              <Shield className="h-8 w-8 text-primary mb-2" />
              <CardTitle>Secure Access</CardTitle>
              <CardDescription>
                Role-based authentication ensures only authorized administrators can access the system.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <Users className="h-8 w-8 text-primary mb-2" />
              <CardTitle>User Management</CardTitle>
              <CardDescription>
                Comprehensive user administration tools for managing accounts, roles, and permissions.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <BarChart3 className="h-8 w-8 text-primary mb-2" />
              <CardTitle>Analytics Dashboard</CardTitle>
              <CardDescription>
                Real-time insights and analytics to monitor system performance and user activity.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* Admin Access Card */}
        <Card className="max-w-md mx-auto">
          <CardHeader className="text-center">
            <CardTitle>Administrator Access</CardTitle>
            <CardDescription>
              Sign in with your admin credentials to access the dashboard
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button asChild className="w-full">
              <Link href="/login">
                Sign In to Dashboard
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
