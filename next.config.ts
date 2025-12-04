import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disable source maps in development to avoid warnings
  productionBrowserSourceMaps: false,
  
  // Use Turbopack configuration (empty to silence warnings)
  turbopack: {},
  
  // External packages for server components (moved from experimental)
  serverExternalPackages: ['@supabase/supabase-js'],
  
  // Image optimization with remotePatterns only
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '3000',
        pathname: '/**',
      },
    ],
  },
  
  // Development settings (minimal configuration for Next.js 16)
};

export default nextConfig;
