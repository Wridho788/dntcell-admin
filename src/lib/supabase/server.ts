// lib/supabase/server.ts
// Server-side Supabase client for SSR usage

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Define a basic Database type if not available
type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          user_id: string;
          role: string;
          created_at: string;
        };
        Insert: {
          user_id: string;
          role?: string;
        };
        Update: {
          role?: string;
        };
      };
      [key: string]: any;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
  };
}

// Validate environment variables
const validateServerEnvVars = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!url) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable');
  }
  
  return { url, serviceKey, anonKey };
};

// Create server client for cookie-based auth
export const createServerSupabaseClient = async () => {
  const { url, anonKey } = validateServerEnvVars();
  const cookieStore = await cookies();

  if (!anonKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable');
  }

  return createServerClient<Database>(
    url,
    anonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch (error) {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  );
};

// Create admin client with service role key
export const createAdminSupabaseClient = () => {
  const { url, serviceKey } = validateServerEnvVars();
  
  if (!serviceKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable');
  }

  return createServerClient<Database>(
    url,
    serviceKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      cookies: {
        getAll() {
          return [];
        },
        setAll() {
          // No-op for admin client
        },
      },
    }
  );
};

// Get current user session
export const getCurrentUser = async () => {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error || !user) {
      return null;
    }
    
    return user;
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
};

// Helper to determine if user should be admin based on email
const shouldBeAdmin = async (userId: string): Promise<boolean> => {
  try {
    const user = await getCurrentUser();
    if (user && user.id === userId && user.email === 'admin@dntcell.com') {
      return true;
    }
    return false;
  } catch {
    return false;
  }
};

// Check if user is admin
export const isUserAdmin = async (userId: string): Promise<boolean> => {
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', userId)
      .maybeSingle(); // Use maybeSingle() instead of single() to handle 0 rows
    
    if (error) {
      console.error('Error checking admin status:', error);
      return false;
    }
    
    // If no profile exists, create one with appropriate role
    if (!data) {
      const isAdmin = await shouldBeAdmin(userId);
      const defaultRole = isAdmin ? 'admin' : 'user';
      
      console.log(`No profile found for user ${userId}, creating profile with role: ${defaultRole}`);
      const { data: newProfile, error: insertError } = await supabase
        .from('profiles')
        .insert({ user_id: userId, role: defaultRole })
        .select('role')
        .single();
      
      if (insertError || !newProfile) {
        console.error('Error creating default profile:', insertError);
        return false;
      }
      
      return (newProfile as any).role === 'admin';
    }
    
    return (data as any).role === 'admin';
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
};

// Get user profile
export const getUserProfile = async (userId: string) => {
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle(); // Use maybeSingle() instead of single() to handle 0 rows
    
    if (error) {
      console.error('Error getting user profile:', error);
      return null;
    }
    
    // If no profile exists, create one with appropriate role
    if (!data) {
      const isAdmin = await shouldBeAdmin(userId);
      const defaultRole = isAdmin ? 'admin' : 'user';
      
      console.log(`No profile found for user ${userId}, creating profile with role: ${defaultRole}`);
      const { data: newProfile, error: insertError } = await supabase
        .from('profiles')
        .insert({ 
          user_id: userId, 
          role: defaultRole
        })
        .select('*')
        .single();
      
      if (insertError || !newProfile) {
        console.error('Error creating default profile:', insertError);
        return null;
      }
      
      return newProfile as any;
    }
    
    return data as any;
  } catch (error) {
    console.error('Error getting user profile:', error);
    return null;
  }
};