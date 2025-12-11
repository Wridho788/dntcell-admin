import { NextRequest } from 'next/server'
import { getUserFromAuth, isUserAdmin } from './supabase-server'
import { unauthorizedResponse, forbiddenResponse } from './response'

export interface AuthContext {
  userId: string
  isAdmin: boolean
}

export async function requireAuth(request: NextRequest): Promise<AuthContext | null> {
  const authHeader = request.headers.get('authorization')
  
  const user = await getUserFromAuth(authHeader)
  
  if (!user) {
    return null
  }

  const admin = await isUserAdmin(user.id)

  return {
    userId: user.id,
    isAdmin: admin,
  }
}

export async function requireAdmin(request: NextRequest) {
  const auth = await requireAuth(request)
  
  if (!auth) {
    return unauthorizedResponse('Authentication required')
  }

  if (!auth.isAdmin) {
    return forbiddenResponse('Admin access required')
  }

  return auth
}
