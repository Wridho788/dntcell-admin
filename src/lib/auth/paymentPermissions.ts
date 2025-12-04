// lib/auth/paymentPermissions.ts - Payment Access Control System
'use client';

import { User } from '@supabase/supabase-js';
import { supabase } from '../supabase/client';

// Payment Permission Types
export type PaymentPermission = 
  | 'payment:read'
  | 'payment:write'
  | 'payment:verify'
  | 'payment:reject'
  | 'payment:delete'
  | 'payment:batch_verify'
  | 'payment:batch_reject'
  | 'payment:proof_upload'
  | 'payment:proof_delete'
  | 'payment:stats'
  | 'payment:audit_log';

// Role-based Permission Mapping
export const ROLE_PERMISSIONS: Record<string, PaymentPermission[]> = {
  super_admin: [
    'payment:read',
    'payment:write',
    'payment:verify',
    'payment:reject',
    'payment:delete',
    'payment:batch_verify',
    'payment:batch_reject',
    'payment:proof_upload',
    'payment:proof_delete',
    'payment:stats',
    'payment:audit_log'
  ],
  admin: [
    'payment:read',
    'payment:write',
    'payment:verify',
    'payment:reject',
    'payment:batch_verify',
    'payment:batch_reject',
    'payment:proof_upload',
    'payment:proof_delete',
    'payment:stats'
  ],
  payment_verifier: [
    'payment:read',
    'payment:verify',
    'payment:reject',
    'payment:proof_upload',
    'payment:stats'
  ],
  payment_viewer: [
    'payment:read',
    'payment:stats'
  ],
  customer_service: [
    'payment:read',
    'payment:verify',
    'payment:proof_upload'
  ]
};

// User Profile Interface (extend as needed)
export interface UserProfile {
  id: string;
  email: string;
  role: string;
  department?: string;
  permissions?: PaymentPermission[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Permission Checker Class
export class PaymentPermissionChecker {
  private user: User | null;
  private userProfile: UserProfile | null;

  constructor(user: User | null, userProfile: UserProfile | null) {
    this.user = user;
    this.userProfile = userProfile;
  }

  // Check if user has specific permission
  hasPermission(permission: PaymentPermission): boolean {
    if (!this.user || !this.userProfile) {
      return false;
    }

    // Check if user is active
    if (!this.userProfile.is_active) {
      return false;
    }

    // Check custom permissions first
    if (this.userProfile.permissions && this.userProfile.permissions.includes(permission)) {
      return true;
    }

    // Check role-based permissions
    const rolePermissions = ROLE_PERMISSIONS[this.userProfile.role] || [];
    return rolePermissions.includes(permission);
  }

  // Check multiple permissions (all must be true)
  hasAllPermissions(permissions: PaymentPermission[]): boolean {
    return permissions.every(permission => this.hasPermission(permission));
  }

  // Check multiple permissions (at least one must be true)
  hasAnyPermission(permissions: PaymentPermission[]): boolean {
    return permissions.some(permission => this.hasPermission(permission));
  }

  // Check if user can perform bulk operations
  canPerformBulkOperations(): boolean {
    return this.hasAnyPermission(['payment:batch_verify', 'payment:batch_reject']);
  }

  // Check if user can access payment management at all
  canAccessPaymentManagement(): boolean {
    return this.hasPermission('payment:read');
  }

  // Check if user can modify payments
  canModifyPayments(): boolean {
    return this.hasPermission('payment:write');
  }

  // Check payment-specific permissions with context
  canVerifyPayment(paymentAmount?: number): boolean {
    if (!this.hasPermission('payment:verify')) return false;

    // Additional business rules can be added here
    // For example, limit verification amount based on role
    if (paymentAmount && this.userProfile?.role === 'payment_verifier') {
      const maxAmount = 10000000; // 10 million IDR limit for verifiers
      return paymentAmount <= maxAmount;
    }

    return true;
  }

  canRejectPayment(): boolean {
    return this.hasPermission('payment:reject');
  }

  canDeletePayment(): boolean {
    return this.hasPermission('payment:delete');
  }

  canUploadProof(): boolean {
    return this.hasPermission('payment:proof_upload');
  }

  canDeleteProof(): boolean {
    return this.hasPermission('payment:proof_delete');
  }

  canViewStats(): boolean {
    return this.hasPermission('payment:stats');
  }

  canViewAuditLog(): boolean {
    return this.hasPermission('payment:audit_log');
  }

  // Get user role for display
  getUserRole(): string {
    return this.userProfile?.role || 'unauthorized';
  }

  // Get user email for display
  getUserEmail(): string {
    return this.user?.email || 'unknown';
  }

  // Get user ID for audit logging
  getUserId(): string {
    return this.user?.id || 'anonymous';
  }
}

// Note: React hooks and components moved to separate file to avoid TypeScript JSX issues

// Utility function to check permissions in server actions
export async function checkPaymentPermission(
  userId: string,
  permission: PaymentPermission
): Promise<boolean> {
  try {
    const { data: profile, error } = await supabase
      .from('admin_profiles')
      .select('role, permissions, is_active')
      .eq('id', userId)
      .single();

    if (error || !profile || !profile.is_active) {
      return false;
    }

    // Check custom permissions first
    if (profile.permissions && profile.permissions.includes(permission)) {
      return true;
    }

    // Check role-based permissions
    const rolePermissions = ROLE_PERMISSIONS[profile.role] || [];
    return rolePermissions.includes(permission);

  } catch (error) {
    console.error('Permission check error:', error);
    return false;
  }
}

// Error classes for permission-related errors
export class PaymentPermissionError extends Error {
  constructor(message: string, public permission: PaymentPermission) {
    super(message);
    this.name = 'PaymentPermissionError';
  }
}

export class PaymentAccessDeniedError extends Error {
  constructor(message: string = 'Access denied to payment management') {
    super(message);
    this.name = 'PaymentAccessDeniedError';
  }
}