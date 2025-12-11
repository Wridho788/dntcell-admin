/**
 * Notification Service
 * Handles all notification-related API operations
 */

import { api } from '../api-client';

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  is_read: boolean;
  meta?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface NotificationFilters {
  is_read?: boolean;
  type?: 'info' | 'success' | 'warning' | 'error';
  page?: number;
  limit?: number;
}

export interface CreateNotificationPayload {
  user_id: string;
  title: string;
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  meta?: Record<string, any>;
}

export const notificationService = {
  /**
   * Get list of notifications for current user
   */
  async getNotifications(filters?: NotificationFilters) {
    return api.get<Notification[]>('/notifications', filters);
  },

  /**
   * Send notification to user (admin only)
   */
  async sendNotification(payload: CreateNotificationPayload) {
    return api.post<Notification>('/notifications', payload);
  },
};
