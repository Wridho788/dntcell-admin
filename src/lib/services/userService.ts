/**
 * User Service
 * Handles all user-related API operations
 */

import { api } from '../api-client';

export interface User {
  id: string;
  email: string;
  full_name: string;
  phone: string;
  role: 'user' | 'admin';
  onesignal_player_id?: string;
  created_at: string;
  updated_at: string;
}

export interface UserFilters {
  role?: 'user' | 'admin';
  page?: number;
  limit?: number;
}

export interface CurrentUserProfile extends User {
  isAdmin: boolean;
}

export const userService = {
  /**
   * Get list of all users (admin only)
   */
  async getUsers(filters?: UserFilters) {
    return api.get<User[]>('/users', filters);
  },

  /**
   * Get current user profile
   */
  async getCurrentUser() {
    return api.get<CurrentUserProfile>('/users/me');
  },
};
