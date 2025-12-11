/**
 * Negotiation Service
 * Handles all negotiation-related API operations
 */

import { api } from '../api-client';

export interface Negotiation {
  id: string;
  product_id: string;
  buyer_id: string;
  offered_price: number;
  status: 'pending' | 'approved' | 'rejected';
  buyer_note?: string;
  admin_note?: string;
  final_price?: number;
  is_used: boolean;
  created_at: string;
  updated_at: string;
}

export interface NegotiationWithRelations extends Negotiation {
  product?: {
    id: string;
    name: string;
    base_price: number;
    seller_id: string;
  };
  buyer?: {
    id: string;
    full_name: string;
    phone: string;
  };
}

export interface NegotiationFilters {
  product_id?: string;
  buyer_id?: string;
  status?: 'pending' | 'approved' | 'rejected';
  is_used?: boolean;
  page?: number;
  limit?: number;
}

export interface CreateNegotiationPayload {
  product_id: string;
  offered_price: number;
  buyer_note?: string;
}

export interface ApproveNegotiationPayload {
  final_price: number;
  admin_note?: string;
}

export interface RejectNegotiationPayload {
  admin_note: string;
}

export const negotiationService = {
  /**
   * Get list of negotiations with filters
   */
  async getNegotiations(filters?: NegotiationFilters) {
    return api.get<NegotiationWithRelations[]>('/negotiations', filters);
  },

  /**
   * Get single negotiation by ID
   */
  async getNegotiationById(id: string) {
    return api.get<NegotiationWithRelations>(`/negotiations/${id}`);
  },

  /**
   * Create new negotiation
   */
  async createNegotiation(payload: CreateNegotiationPayload) {
    return api.post<Negotiation>('/negotiations', payload);
  },

  /**
   * Approve negotiation (admin only)
   */
  async approveNegotiation(id: string, payload: ApproveNegotiationPayload) {
    return api.post<Negotiation>(`/negotiations/${id}/approve`, payload);
  },

  /**
   * Reject negotiation (admin only)
   */
  async rejectNegotiation(id: string, payload: RejectNegotiationPayload) {
    return api.post<Negotiation>(`/negotiations/${id}/reject`, payload);
  },
};
