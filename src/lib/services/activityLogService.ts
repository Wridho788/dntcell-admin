/**
 * Activity Log Service
 * Handles all activity log-related API operations
 */

import { api } from '../api-client';

export interface ActivityLog {
  id: string;
  admin_id: string;
  action: string;
  meta?: Record<string, any>;
  created_at: string;
}

export interface ActivityLogWithAdmin extends ActivityLog {
  admin?: {
    id: string;
    full_name: string;
    email: string;
  };
}

export interface ActivityLogFilters {
  admin_id?: string;
  action?: string;
  page?: number;
  limit?: number;
}

export const activityLogService = {
  /**
   * Get list of activity logs (admin only)
   */
  async getActivityLogs(filters?: ActivityLogFilters) {
    return api.get<ActivityLogWithAdmin[]>('/activity', filters);
  },
};
