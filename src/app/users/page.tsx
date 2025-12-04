import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/supabase/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { AdminLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Plus, Search, Filter, MoreHorizontal } from 'lucide-react'
import { Input } from '@/components/ui/input'

// Type definition for Profile
type Profile = {
  id: string
  user_id: string
  email: string | null
  role: string
  created_at: string
}

export const metadata: Metadata = {
  title: 'User Management',
  description: 'Manage system users and their permissions',
}

// Fetch profiles data from Supabase
async function getProfiles(): Promise<Profile[]> {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('id, user_id, email, role, created_at')
      .order('created_at', { ascending: false })
    
    if (error) {
      console.error('Error fetching profiles:', error)
      return []
    }
    
    return (profiles as unknown as Profile[]) || []
  } catch (error) {
    console.error('Error in getProfiles:', error)
    return []
  }
}

export default async function UsersPage() {
  // Check authentication
  const user = await getCurrentUser()
  if (!user) {
    redirect('/login')
  }

  // Fetch profiles data
  const profiles = await getProfiles()
  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Users</h1>
            <p className="text-muted-foreground">
              Manage user accounts and permissions
            </p>
          </div>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add User
          </Button>
        </div>

        {/* Search and Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Search Users</CardTitle>
            <CardDescription>
              Find and filter users by name, email, or role
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex space-x-2">
              <div className="flex-1">
                <Input placeholder="Search users..." className="w-full" />
              </div>
              <Button variant="outline">
                <Search className="mr-2 h-4 w-4" />
                Search
              </Button>
              <Button variant="outline">
                <Filter className="mr-2 h-4 w-4" />
                Filters
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Users Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Users</CardTitle>
            <CardDescription>
              A list of all users in the system
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created At</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {profiles.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      No users found
                    </TableCell>
                  </TableRow>
                ) : (
                  profiles.map((profile: Profile) => (
                    <TableRow key={profile.id}>
                      <TableCell className="font-medium">
                        {profile.email?.split('@')[0] || 'Unknown'}
                      </TableCell>
                      <TableCell>{profile.email || 'No email'}</TableCell>
                      <TableCell>
                        <Badge 
                          variant={
                            profile.role === 'admin' || profile.role === 'super_admin' 
                              ? 'default' 
                              : 'secondary'
                          }
                        >
                          {profile.role || 'user'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant="default"
                          className="bg-green-100 text-green-800"
                        >
                          active
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {profile.created_at 
                          ? new Date(profile.created_at).toLocaleDateString() 
                          : 'Unknown'
                        }
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  )
}