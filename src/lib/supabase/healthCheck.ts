import { supabase } from '@/lib/supabase/client';

export const supabaseHealthCheck = {
  // Test basic Supabase connection
  async testConnection(): Promise<{ success: boolean; message: string; details?: any }> {
    try {
      // Test if we can connect to Supabase
      const { data, error } = await supabase.from('products').select('count').limit(1);
      
      if (error) {
        if (error.message.includes('relation "public.products" does not exist')) {
          return {
            success: false,
            message: 'Products table does not exist. Please run the database setup script.',
            details: { 
              error: error.message,
              solution: 'Run the SQL script from database/supabase_products_setup.sql in your Supabase SQL Editor'
            }
          };
        }
        
        return {
          success: false,
          message: 'Database connection failed',
          details: { error: error.message }
        };
      }
      
      return {
        success: true,
        message: 'Supabase connection successful',
        details: { connected: true }
      };
    } catch (error: any) {
      return {
        success: false,
        message: 'Network or configuration error',
        details: { 
          error: error.message,
          suggestion: 'Check your NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local'
        }
      };
    }
  },

  // Test if all required tables exist
  async testTables(): Promise<{ success: boolean; message: string; details?: any }> {
    try {
        // Define required tables
  const requiredTables = [
    'products',
    'product_images',
    'categories',
    'profiles'
  ];
      const results = await Promise.allSettled(
        requiredTables.map(async (table: string) => {
          const { error } = await supabase.from(table).select('count').limit(1);
          return { table, exists: !error };
        })
      );

      const tableStatus = results.map((result: any, index: number) => {
        const tableName = requiredTables[index];
        if (result.status === 'fulfilled') {
          return { table: tableName, exists: result.value.exists };
        }
        return { table: tableName, exists: false };
      });

      const existingTables = tableStatus.filter((t: any) => t.exists);
      const missingTables = tableStatus.filter((t: any) => !t.exists);

      return {
        success: missingTables.length === 0,
        message: `Found ${existingTables.length}/${requiredTables.length} required tables`,
        details: { 
          existing: existingTables.map((t: any) => t.table),
          missing: missingTables.map((t: any) => t.table)
        }
      };
    } catch (error: any) {
      return {
        success: false,
        message: 'Could not check table status',
        details: { error: error.message }
      };
    }
  },

  // Get basic stats about the database
  async getDatabaseStats(): Promise<{ success: boolean; message: string; details?: any }> {
    try {
      const { data: products, error } = await supabase
        .from('products')
        .select('id, status, created_at')
        .limit(100);

      if (error) {
        return {
          success: false,
          message: 'Could not retrieve database statistics',
          details: { error: error.message }
        };
      }

      const stats = {
        totalProducts: products?.length || 0,
        activeProducts: products?.filter((p: any) => p.status === 'active').length || 0,
        recentProducts: products?.filter((p: any) => {
          const created = new Date(p.created_at);
          const weekAgo = new Date();
          weekAgo.setDate(weekAgo.getDate() - 7);
          return created > weekAgo;
        }).length || 0
      };

      return {
        success: true,
        message: 'Database statistics retrieved',
        details: stats
      };
    } catch (error: any) {
      return {
        success: false,
        message: 'Error retrieving statistics',
        details: { error: error.message }
      };
    }
  },

  // Run all checks
  async runAllChecks(): Promise<{ 
    connection: any; 
    tables: any; 
    stats: any; 
    overall: { success: boolean; message: string } 
  }> {
    console.log('🔍 Running Supabase health checks...');
    
    const connection = await this.testConnection();
    const tables = await this.testTables();
    const stats = await this.getDatabaseStats();

    const overallSuccess = connection.success && tables.success;
    
    const result = {
      connection,
      tables,
      stats,
      overall: {
        success: overallSuccess,
        message: overallSuccess 
          ? '✅ Supabase integration is working correctly'
          : '⚠️ Supabase setup needs attention'
      }
    };

    console.log('📊 Health Check Results:', result);
    return result;
  }
};