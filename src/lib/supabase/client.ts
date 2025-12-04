// lib/supabase/client.ts
// Client-side Supabase client for browser usage

import { createBrowserClient } from '@supabase/ssr'

// Define a basic Database type if not available
type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          role: string;
          created_at: string;
        };
        Insert: {
          id: string;
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
const validateEnvVars = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!url || !key) {
    console.error('Missing Supabase environment variables:');
    console.error('NEXT_PUBLIC_SUPABASE_URL:', url ? '✓ Set' : '✗ Missing');
    console.error('NEXT_PUBLIC_SUPABASE_ANON_KEY:', key ? '✓ Set' : '✗ Missing');
    throw new Error('Supabase environment variables are not properly configured');
  }
  
  return { url, key };
};

export const createClient = () => {
  const { url, key } = validateEnvVars();
  
  return createBrowserClient<Database>(url, key, {
    auth: {
      persistSession: true,
      detectSessionInUrl: true
    },
    global: {
      headers: {
        'x-client-info': 'dntcell-admin@1.0.0'
      }
    }
  })
}

// Enhanced client with error handling
class EnhancedSupabaseClient {
  private client: ReturnType<typeof createClient>;
  
  constructor() {
    try {
      this.client = createClient();
    } catch (error) {
      console.error('Failed to create Supabase client:', error);
      throw error;
    }
  }

  // Proxy all Supabase methods with error handling
  get from() {
    return this.client.from.bind(this.client);
  }

  get auth() {
    return this.client.auth;
  }

  get storage() {
    return this.client.storage;
  }

  get rpc() {
    return this.client.rpc.bind(this.client);
  }

  get channel() {
    return this.client.channel?.bind(this.client);
  }

  get realtime() {
    return this.client.realtime;
  }

  // Test connection method
  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await this.client.from('categories').select('count').limit(1);
      
      if (error) {
        return { success: false, error: error.message };
      }
      
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown connection error'
      };
    }
  }
}

// Singleton instance for client-side
let supabaseClient: EnhancedSupabaseClient | null = null;

export const getSupabaseClient = () => {
  if (!supabaseClient) {
    try {
      supabaseClient = new EnhancedSupabaseClient();
    } catch (error) {
      console.error('Failed to initialize Supabase client:', error);
      // Return a mock client for development to prevent crashes
      return {
        from: () => ({ select: () => Promise.resolve({ data: [], error: new Error('Supabase not configured') }) }),
        auth: {},
        storage: {},
        rpc: () => Promise.resolve({ data: null, error: new Error('Supabase not configured') }),
        channel: () => ({
          on: () => ({ subscribe: () => {} }),
          subscribe: () => {}
        }),
        realtime: {},
        testConnection: () => Promise.resolve({ success: false, error: 'Supabase not configured' })
      } as any;
    }
  }
  return supabaseClient;
}

// Export default instance
export const supabase = getSupabaseClient();

// Export a simple direct client for cases where enhanced features aren't needed
export const createSimpleClient = () => {
  const { url, key } = validateEnvVars();
  return createBrowserClient<Database>(url, key);
};