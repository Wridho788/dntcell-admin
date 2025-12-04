// lib/middleware/paymentSecurity.ts - Payment API Security Middleware
'use client';

import { NextRequest, NextResponse } from 'next/server';
// import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'; // Comment out for now
import { cookies } from 'next/headers';
import { checkPaymentPermission, PaymentPermission } from '../auth/paymentPermissions';
import { PaymentAuditLogger } from '../audit/paymentAuditLog';

// Rate limiting configuration
interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  message?: string;
}

// Default rate limits by operation type
const DEFAULT_RATE_LIMITS: Record<string, RateLimitConfig> = {
  'payment:read': { windowMs: 60 * 1000, maxRequests: 100 }, // 100 requests per minute
  'payment:write': { windowMs: 60 * 1000, maxRequests: 20 }, // 20 requests per minute
  'payment:verify': { windowMs: 60 * 1000, maxRequests: 50 }, // 50 requests per minute
  'payment:batch_verify': { windowMs: 60 * 1000, maxRequests: 5 }, // 5 requests per minute
  'payment:delete': { windowMs: 60 * 1000, maxRequests: 10 }, // 10 requests per minute
};

// In-memory rate limit store (in production, use Redis or similar)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// Security validation result
interface SecurityValidationResult {
  success: boolean;
  error?: string;
  statusCode?: number;
  user?: any;
  userProfile?: any;
}

// Payment Security Middleware Class
export class PaymentSecurityMiddleware {
  // Validate authentication
  static async validateAuthentication(request: NextRequest): Promise<SecurityValidationResult> {
    try {
      // TODO: Implement proper authentication validation
      // const supabase = createRouteHandlerClient({ cookies });
      // const { data: { user }, error } = await supabase.auth.getUser();
      const user = null;
      const error = 'Not implemented';

      if (error || !user) {
        return {
          success: false,
          error: 'Authentication required',
          statusCode: 401
        };
      }

      // TODO: Get user profile
      // const { data: userProfile, error: profileError } = await supabase
      //   .from('admin_profiles')
      //   .select('*')
      //   .eq('id', user.id)
      //   .single();

      const userProfile = null;
      const profileError = 'Not implemented';

      if (profileError || !userProfile) {
        return {
          success: false,
          error: 'User profile not found',
          statusCode: 403
        };
      }

      // TODO: Check if user is active
      // if (!userProfile.is_active) {
      //   return {
      //     success: false,
      //     error: 'User account is deactivated',
      //     statusCode: 403
      //   };
      // }

      // TODO: Return actual user and profile
      return {
        success: false,
        error: 'Authentication not implemented',
        statusCode: 501
      };
    } catch (error) {
      return {
        success: false,
        error: 'Authentication validation failed',
        statusCode: 500
      };
    }
  }

  // Validate permissions
  static async validatePermission(
    userId: string,
    permission: PaymentPermission
  ): Promise<SecurityValidationResult> {
    try {
      const hasPermission = await checkPaymentPermission(userId, permission);

      if (!hasPermission) {
        return {
          success: false,
          error: `Insufficient permissions: ${permission} required`,
          statusCode: 403
        };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: 'Permission validation failed',
        statusCode: 500
      };
    }
  }

  // Rate limiting
  static validateRateLimit(
    userId: string,
    operation: string,
    customConfig?: RateLimitConfig
  ): SecurityValidationResult {
    const config = customConfig || DEFAULT_RATE_LIMITS[operation] || DEFAULT_RATE_LIMITS['payment:read'];
    const key = `${userId}:${operation}`;
    const now = Date.now();
    
    const userLimit = rateLimitStore.get(key);
    
    if (!userLimit || now > userLimit.resetTime) {
      // Reset or initialize
      rateLimitStore.set(key, {
        count: 1,
        resetTime: now + config.windowMs
      });
      return { success: true };
    }
    
    if (userLimit.count >= config.maxRequests) {
      return {
        success: false,
        error: config.message || `Rate limit exceeded for ${operation}`,
        statusCode: 429
      };
    }
    
    // Increment count
    userLimit.count++;
    rateLimitStore.set(key, userLimit);
    
    return { success: true };
  }

  // Input validation and sanitization
  static validateInput(
    data: any,
    rules: Record<string, {
      required?: boolean;
      type?: 'string' | 'number' | 'boolean' | 'array' | 'object';
      minLength?: number;
      maxLength?: number;
      pattern?: RegExp;
      allowedValues?: any[];
    }>
  ): SecurityValidationResult {
    try {
      for (const [field, rule] of Object.entries(rules)) {
        const value = data[field];

        // Check required fields
        if (rule.required && (value === undefined || value === null || value === '')) {
          return {
            success: false,
            error: `Field '${field}' is required`,
            statusCode: 400
          };
        }

        // Skip validation if field is not provided and not required
        if (value === undefined || value === null) {
          continue;
        }

        // Type validation
        if (rule.type) {
          const actualType = Array.isArray(value) ? 'array' : typeof value;
          if (actualType !== rule.type) {
            return {
              success: false,
              error: `Field '${field}' must be of type ${rule.type}`,
              statusCode: 400
            };
          }
        }

        // String validations
        if (typeof value === 'string') {
          if (rule.minLength && value.length < rule.minLength) {
            return {
              success: false,
              error: `Field '${field}' must be at least ${rule.minLength} characters`,
              statusCode: 400
            };
          }

          if (rule.maxLength && value.length > rule.maxLength) {
            return {
              success: false,
              error: `Field '${field}' must not exceed ${rule.maxLength} characters`,
              statusCode: 400
            };
          }

          if (rule.pattern && !rule.pattern.test(value)) {
            return {
              success: false,
              error: `Field '${field}' format is invalid`,
              statusCode: 400
            };
          }
        }

        // Allowed values validation
        if (rule.allowedValues && !rule.allowedValues.includes(value)) {
          return {
            success: false,
            error: `Field '${field}' must be one of: ${rule.allowedValues.join(', ')}`,
            statusCode: 400
          };
        }
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: 'Input validation failed',
        statusCode: 400
      };
    }
  }

  // Sanitize input to prevent XSS and injection attacks
  static sanitizeInput(data: any): any {
    if (typeof data === 'string') {
      return data
        .replace(/[<>]/g, '') // Remove basic HTML tags
        .replace(/javascript:/gi, '') // Remove javascript: protocols
        .replace(/on\w+=/gi, '') // Remove event handlers
        .trim();
    }

    if (Array.isArray(data)) {
      return data.map(item => this.sanitizeInput(item));
    }

    if (typeof data === 'object' && data !== null) {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(data)) {
        sanitized[key] = this.sanitizeInput(value);
      }
      return sanitized;
    }

    return data;
  }

  // Comprehensive security check
  static async validateSecurity(
    request: NextRequest,
    requiredPermission: PaymentPermission,
    inputRules?: Record<string, any>,
    rateLimitConfig?: RateLimitConfig
  ): Promise<SecurityValidationResult> {
    // 1. Authentication check
    const authResult = await this.validateAuthentication(request);
    if (!authResult.success) {
      return authResult;
    }

    const { user, userProfile } = authResult;

    // 2. Permission check
    const permissionResult = await this.validatePermission(user.id, requiredPermission);
    if (!permissionResult.success) {
      return permissionResult;
    }

    // 3. Rate limiting
    const rateLimitResult = this.validateRateLimit(user.id, requiredPermission, rateLimitConfig);
    if (!rateLimitResult.success) {
      return rateLimitResult;
    }

    // 4. Input validation (if rules provided)
    if (inputRules) {
      try {
        const body = await request.json();
        const inputResult = this.validateInput(body, inputRules);
        if (!inputResult.success) {
          return inputResult;
        }
      } catch (error) {
        // If JSON parsing fails, continue (might be GET request or different content type)
      }
    }

    return {
      success: true,
      user,
      userProfile
    };
  }

  // Create secured API handler wrapper
  static createSecuredHandler(
    requiredPermission: PaymentPermission,
    handler: (request: NextRequest, context: { user: any; userProfile: any }) => Promise<NextResponse>,
    options: {
      inputRules?: Record<string, any>;
      rateLimitConfig?: RateLimitConfig;
      auditEvent?: string;
    } = {}
  ) {
    return async (request: NextRequest) => {
      try {
        // Security validation
        const securityResult = await this.validateSecurity(
          request,
          requiredPermission,
          options.inputRules,
          options.rateLimitConfig
        );

        if (!securityResult.success) {
          return NextResponse.json(
            { 
              error: securityResult.error,
              code: 'SECURITY_VALIDATION_FAILED'
            },
            { status: securityResult.statusCode || 500 }
          );
        }

        const { user, userProfile } = securityResult;

        // Initialize audit logger
        if (options.auditEvent) {
          const auditLogger = PaymentAuditLogger.getInstance();
          auditLogger.setUserContext(user.id, user.email, userProfile.role);
        }

        // Execute the actual handler
        const response = await handler(request, { user, userProfile });

        // Log successful operation
        if (options.auditEvent) {
          const auditLogger = PaymentAuditLogger.getInstance();
          await auditLogger.logEvent(
            options.auditEvent as any,
            `${requiredPermission} operation completed`,
            request.url,
            {
              metadata: {
                method: request.method,
                url: request.url,
                status: response.status
              }
            }
          );
        }

        return response;

      } catch (error) {
        console.error('Secured handler error:', error);
        
        return NextResponse.json(
          { 
            error: 'Internal server error',
            code: 'INTERNAL_ERROR'
          },
          { status: 500 }
        );
      }
    };
  }
}

// Utility function to create error response
export function createSecurityErrorResponse(message: string, code: string, status: number = 403) {
  return NextResponse.json(
    {
      error: message,
      code,
      timestamp: new Date().toISOString()
    },
    { status }
  );
}

// Common input validation rules
export const COMMON_VALIDATION_RULES = {
  paymentId: {
    required: true,
    type: 'string' as const,
    pattern: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  },
  notes: {
    type: 'string' as const,
    maxLength: 500
  },
  reason: {
    required: true,
    type: 'string' as const,
    minLength: 10,
    maxLength: 200
  },
  paymentIds: {
    required: true,
    type: 'array' as const
  },
  verified: {
    type: 'boolean' as const
  },
  paymentType: {
    type: 'string' as const,
    allowedValues: ['bank_transfer', 'ewallet', 'cod', 'credit_card']
  }
};