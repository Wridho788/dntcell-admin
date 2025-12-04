// Debug utilities for Supabase connection
import { supabase } from './client';

export class SupabaseDebug {
  static async testConnection(): Promise<{ success: boolean; error?: string; details?: any }> {
    try {
      console.log('Testing Supabase connection...');
      
      // Use lighter auth test instead of database query
      const { data, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('Supabase connection error:', error);
        return {
          success: false,
          error: error.message,
          details: error
        };
      }
      
      console.log('Supabase connection successful');
      return { success: true };
    } catch (error) {
      console.error('Network error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error
      };
    }
  }

  static async testCategoriesTable(): Promise<{ success: boolean; error?: string; data?: any }> {
    try {
      console.log('Testing categories table access...');
      
      // Use minimal query to test table access
      const { data, error } = await supabase
        .from('categories')
        .select('id')
        .limit(1);
      
      if (error) {
        return {
          success: false,
          error: error.message,
          data: null
        };
      }
      
      return {
        success: true,
        data: data
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  static logEnvironmentInfo(): void {
    console.log('Environment Info:');
    console.log('NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL || 'NOT SET');
    console.log('NEXT_PUBLIC_SUPABASE_ANON_KEY:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'SET' : 'NOT SET');
    console.log('Current URL:', typeof window !== 'undefined' ? window.location.origin : 'Server-side');
  }
}

// Auto-run debug is disabled to prevent repeated API calls
// Call SupabaseDebug.testConnection() manually when needed