// lib/audit/paymentAuditLog.ts - Payment Audit Logging System
'use client';

import { supabase } from '../supabase/client';

// Audit Log Event Types
export type PaymentAuditEvent =
  | 'payment_created'
  | 'payment_updated'
  | 'payment_verified'
  | 'payment_rejected'
  | 'payment_deleted'
  | 'payment_batch_verified'
  | 'payment_batch_rejected'
  | 'proof_uploaded'
  | 'proof_deleted'
  | 'payment_viewed'
  | 'payment_exported'
  | 'payment_filtered'
  | 'stats_viewed';

// Audit Log Entry Interface
export interface PaymentAuditLog {
  id: string;
  event_type: PaymentAuditEvent;
  event_description: string;
  user_id: string;
  user_email: string;
  user_role?: string;
  payment_id?: string;
  proof_id?: string;
  affected_resource: string;
  old_values?: Record<string, any>;
  new_values?: Record<string, any>;
  metadata?: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
  session_id?: string;
  created_at: string;
}

// Audit Logger Class
export class PaymentAuditLogger {
  private static instance: PaymentAuditLogger;
  private userId: string | null = null;
  private userEmail: string | null = null;
  private userRole: string | null = null;
  private sessionId: string | null = null;

  private constructor() {}

  public static getInstance(): PaymentAuditLogger {
    if (!PaymentAuditLogger.instance) {
      PaymentAuditLogger.instance = new PaymentAuditLogger();
    }
    return PaymentAuditLogger.instance;
  }

  // Set current user context
  setUserContext(userId: string, userEmail: string, userRole?: string, sessionId?: string) {
    this.userId = userId;
    this.userEmail = userEmail;
    this.userRole = userRole || null;
    this.sessionId = sessionId || null;
  }

  // Get client info
  private getClientInfo() {
    return {
      ip_address: this.getClientIP(),
      user_agent: navigator.userAgent,
    };
  }

  private getClientIP(): string {
    // In a real implementation, you might get this from a service
    // For now, we'll use 'unknown' as it's difficult to get real IP from client-side
    return 'client-side';
  }

  // Generic audit log method
  async logEvent(
    eventType: PaymentAuditEvent,
    eventDescription: string,
    affectedResource: string,
    options: {
      paymentId?: string;
      proofId?: string;
      oldValues?: Record<string, any>;
      newValues?: Record<string, any>;
      metadata?: Record<string, any>;
    } = {}
  ): Promise<void> {
    if (!this.userId || !this.userEmail) {
      console.warn('PaymentAuditLogger: User context not set');
      return;
    }

    const auditEntry: Omit<PaymentAuditLog, 'id' | 'created_at'> = {
      event_type: eventType,
      event_description: eventDescription,
      user_id: this.userId,
      user_email: this.userEmail,
      user_role: this.userRole || undefined,
      payment_id: options.paymentId,
      proof_id: options.proofId,
      affected_resource: affectedResource,
      old_values: options.oldValues,
      new_values: options.newValues,
      metadata: {
        ...options.metadata,
        timestamp: new Date().toISOString(),
        session_id: this.sessionId,
      },
      session_id: this.sessionId || undefined,
      ...this.getClientInfo(),
    };

    try {
      const { error } = await supabase
        .from('payment_audit_logs')
        .insert([auditEntry]);

      if (error) {
        console.error('Failed to log audit event:', error);
      }
    } catch (error) {
      console.error('Audit logging error:', error);
    }
  }

  // Specific logging methods
  async logPaymentViewed(paymentId: string, metadata?: Record<string, any>) {
    await this.logEvent(
      'payment_viewed',
      `Payment ${paymentId} viewed`,
      `payment:${paymentId}`,
      { paymentId, metadata }
    );
  }

  async logPaymentVerified(
    paymentId: string, 
    oldValues: Record<string, any>, 
    newValues: Record<string, any>,
    notes?: string
  ) {
    await this.logEvent(
      'payment_verified',
      `Payment ${paymentId} verified${notes ? ` with notes: ${notes}` : ''}`,
      `payment:${paymentId}`,
      { 
        paymentId, 
        oldValues, 
        newValues,
        metadata: { notes }
      }
    );
  }

  async logPaymentRejected(
    paymentId: string, 
    oldValues: Record<string, any>, 
    newValues: Record<string, any>,
    reason: string,
    notes?: string
  ) {
    await this.logEvent(
      'payment_rejected',
      `Payment ${paymentId} rejected. Reason: ${reason}${notes ? `. Notes: ${notes}` : ''}`,
      `payment:${paymentId}`,
      { 
        paymentId, 
        oldValues, 
        newValues,
        metadata: { reason, notes }
      }
    );
  }

  async logPaymentUpdated(
    paymentId: string, 
    oldValues: Record<string, any>, 
    newValues: Record<string, any>
  ) {
    await this.logEvent(
      'payment_updated',
      `Payment ${paymentId} updated`,
      `payment:${paymentId}`,
      { paymentId, oldValues, newValues }
    );
  }

  async logPaymentDeleted(paymentId: string, paymentData: Record<string, any>) {
    await this.logEvent(
      'payment_deleted',
      `Payment ${paymentId} deleted`,
      `payment:${paymentId}`,
      { 
        paymentId, 
        oldValues: paymentData,
        metadata: { deleted_at: new Date().toISOString() }
      }
    );
  }

  async logBatchPaymentVerified(paymentIds: string[], notes?: string) {
    await this.logEvent(
      'payment_batch_verified',
      `Batch verified ${paymentIds.length} payments${notes ? ` with notes: ${notes}` : ''}`,
      `batch:payments`,
      { 
        metadata: { 
          payment_ids: paymentIds, 
          batch_size: paymentIds.length,
          notes
        }
      }
    );
  }

  async logBatchPaymentRejected(paymentIds: string[], reason: string, notes?: string) {
    await this.logEvent(
      'payment_batch_rejected',
      `Batch rejected ${paymentIds.length} payments. Reason: ${reason}${notes ? `. Notes: ${notes}` : ''}`,
      `batch:payments`,
      { 
        metadata: { 
          payment_ids: paymentIds, 
          batch_size: paymentIds.length,
          reason,
          notes
        }
      }
    );
  }

  async logProofUploaded(paymentId: string, proofId: string, filename: string, fileSize: number) {
    await this.logEvent(
      'proof_uploaded',
      `Payment proof uploaded for payment ${paymentId}`,
      `proof:${proofId}`,
      { 
        paymentId, 
        proofId,
        metadata: { 
          filename, 
          file_size: fileSize,
          upload_time: new Date().toISOString()
        }
      }
    );
  }

  async logProofDeleted(paymentId: string, proofId: string, proofData: Record<string, any>) {
    await this.logEvent(
      'proof_deleted',
      `Payment proof deleted for payment ${paymentId}`,
      `proof:${proofId}`,
      { 
        paymentId, 
        proofId,
        oldValues: proofData,
        metadata: { deleted_at: new Date().toISOString() }
      }
    );
  }

  async logStatsViewed(filters?: Record<string, any>) {
    await this.logEvent(
      'stats_viewed',
      'Payment statistics viewed',
      'stats:payment',
      { 
        metadata: { 
          filters,
          view_time: new Date().toISOString()
        }
      }
    );
  }

  async logPaymentFiltered(filters: Record<string, any>, resultCount: number) {
    await this.logEvent(
      'payment_filtered',
      `Payment list filtered, ${resultCount} results`,
      'list:payments',
      { 
        metadata: { 
          filters,
          result_count: resultCount,
          filter_time: new Date().toISOString()
        }
      }
    );
  }

  async logPaymentExported(filters: Record<string, any>, exportType: string, recordCount: number) {
    await this.logEvent(
      'payment_exported',
      `${recordCount} payments exported as ${exportType}`,
      'export:payments',
      { 
        metadata: { 
          filters,
          export_type: exportType,
          record_count: recordCount,
          export_time: new Date().toISOString()
        }
      }
    );
  }
}

// Audit Log Service for querying logs
export class PaymentAuditService {
  static async getAuditLogs(
    filters: {
      eventType?: PaymentAuditEvent;
      userId?: string;
      paymentId?: string;
      dateFrom?: string;
      dateTo?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{ data: PaymentAuditLog[]; count: number }> {
    let query = supabase
      .from('payment_audit_logs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (filters.eventType) {
      query = query.eq('event_type', filters.eventType);
    }

    if (filters.userId) {
      query = query.eq('user_id', filters.userId);
    }

    if (filters.paymentId) {
      query = query.eq('payment_id', filters.paymentId);
    }

    if (filters.dateFrom) {
      query = query.gte('created_at', filters.dateFrom);
    }

    if (filters.dateTo) {
      query = query.lte('created_at', filters.dateTo);
    }

    if (filters.limit) {
      query = query.limit(filters.limit);
    }

    if (filters.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 20) - 1);
    }

    const { data, error, count } = await query;

    if (error) {
      throw new Error(`Failed to fetch audit logs: ${error.message}`);
    }

    return {
      data: data || [],
      count: count || 0
    };
  }

  static async getAuditLogById(id: string): Promise<PaymentAuditLog | null> {
    const { data, error } = await supabase
      .from('payment_audit_logs')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      throw new Error(`Failed to fetch audit log: ${error.message}`);
    }

    return data;
  }

  static async getUserActivitySummary(
    userId: string,
    dateFrom?: string,
    dateTo?: string
  ): Promise<Record<PaymentAuditEvent, number>> {
    let query = supabase
      .from('payment_audit_logs')
      .select('event_type')
      .eq('user_id', userId);

    if (dateFrom) {
      query = query.gte('created_at', dateFrom);
    }

    if (dateTo) {
      query = query.lte('created_at', dateTo);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch user activity: ${error.message}`);
    }

    // Count events by type
    const summary: Record<string, number> = {};
    data?.forEach((log: any) => {
      summary[log.event_type] = (summary[log.event_type] || 0) + 1;
    });

    return summary as Record<PaymentAuditEvent, number>;
  }

  static async getPaymentActivityHistory(paymentId: string): Promise<PaymentAuditLog[]> {
    const { data, error } = await supabase
      .from('payment_audit_logs')
      .select('*')
      .eq('payment_id', paymentId)
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch payment activity: ${error.message}`);
    }

    return data || [];
  }
}

// React Hook for Audit Logging
// import { usePaymentPermissions } from '../../hooks/usePaymentPermissions';
import { useEffect } from 'react';

export function usePaymentAuditLogger() {
  // const { user, userProfile } = usePaymentPermissions();

  useEffect(() => {
    // if (user && userProfile) {
    //   const logger = PaymentAuditLogger.getInstance();
    //   logger.setUserContext(
    //     user.id,
    //     user.email || 'unknown',
    //     userProfile.role,
    //     // Generate or get session ID
    //     `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    //   );
    // }
  }, []);

  return PaymentAuditLogger.getInstance();
}

// Export singleton instance
export const paymentAuditLogger = PaymentAuditLogger.getInstance();