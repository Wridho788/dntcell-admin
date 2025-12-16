import { NextRequest } from 'next/server'
import { z } from 'zod'
import { supabase } from '@/lib/supabase/client'
import { supabaseAdmin } from '@/api/_core/supabase-server'
import { successResponse, errorResponse } from '@/api/_core/response'
import { handleApiError } from '@/api/_core/error'

// Validation schema for registration
const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  full_name: z.string().min(2, 'Full name must be at least 2 characters'),
  phone: z.string().optional(),
})

// POST /api/auth/register - Register new user
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    const validation = registerSchema.safeParse(body)
    if (!validation.success) {
      const errors = validation.error.flatten().fieldErrors
      const errorMessage = Object.entries(errors)
        .map(([field, messages]) => `${field}: ${messages?.join(', ')}`)
        .join('; ')
      return errorResponse(errorMessage || 'Validation failed', 400)
    }

    const { email, password, full_name, phone } = validation.data

    // Check if email already exists
    const { data: existingUser } = await supabaseAdmin
      .from('profiles')
      .select('email')
      .eq('email', email)
      .single()

    if (existingUser) {
      return errorResponse('Email already registered', 400)
    }

    // Create auth user with admin client (to bypass email confirmation if disabled)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm for development
    })

    if (authError || !authData.user) {
      return errorResponse(authError?.message || 'Failed to create user', 400)
    }

    // Create profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        user_id: authData.user.id,
        email,
        full_name,
        phone: phone || null,
        role: 'user', // Default role
        is_active: true,
      })
      .select()
      .single()

    if (profileError) {
      // Rollback: delete auth user if profile creation fails
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      return errorResponse('Failed to create profile', 500)
    }

    // Note: Activity logging is not needed for user self-registration
    // Admin activity logging is separate from user registration events

    return successResponse({
      user: {
        id: authData.user.id,
        email: profile.email,
        full_name: profile.full_name,
        role: profile.role,
      },
    }, 'Registration successful. Please log in.', 201)
  } catch (error) {
    return handleApiError(error)
  }
}
