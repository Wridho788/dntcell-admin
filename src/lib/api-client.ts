import { createClient } from '@/lib/supabase/client'

export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  message?: string
  error?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export class ApiClient {
  private async getAuthToken(): Promise<string | null> {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token || null
  }

  async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const token = await this.getAuthToken()
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    }

    const response = await fetch(`/api${endpoint}`, {
      ...options,
      headers,
    })

    const data = await response.json()
    
    if (!response.ok) {
      throw new Error(data.error || 'Request failed')
    }

    return data
  }

  // Generic HTTP methods
  async get<T>(endpoint: string, params?: Record<string, any>): Promise<ApiResponse<T>> {
    const queryParams = new URLSearchParams()
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, String(value))
        }
      })
    }
    const queryString = queryParams.toString()
    return this.request<T>(`${endpoint}${queryString ? `?${queryString}` : ''}`)
  }

  async post<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    })
  }

  async put<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    })
  }

  async patch<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    })
  }

  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'DELETE',
    })
  }

  // Products
  async getProducts(params?: {
    query?: string
    category_id?: string
    seller_id?: string
    status?: string
    is_active?: boolean
    page?: number
    limit?: number
    sort_by?: string
    sort_order?: string
  }) {
    const queryParams = new URLSearchParams()
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, String(value))
        }
      })
    }
    
    return this.request<{ products: any[]; pagination: any }>(
      `/products?${queryParams.toString()}`
    )
  }

  async getProduct(id: string) {
    return this.request<any>(`/products/${id}`)
  }

  async createProduct(data: any) {
    return this.request<any>('/products', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateProduct(id: string, data: any) {
    return this.request<any>(`/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async deleteProduct(id: string) {
    return this.request<any>(`/products/${id}`, {
      method: 'DELETE',
    })
  }

  // Negotiations
  async getNegotiations(params?: {
    product_id?: string
    status?: string
    page?: number
    limit?: number
  }) {
    const queryParams = new URLSearchParams()
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, String(value))
        }
      })
    }
    
    return this.request<{ negotiations: any[]; pagination: any }>(
      `/negotiations?${queryParams.toString()}`
    )
  }

  async createNegotiation(data: {
    product_id: string
    offer_price: number
    note?: string
  }) {
    return this.request<any>('/negotiations', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async approveNegotiation(id: string, finalPrice: number) {
    return this.request<any>(`/negotiations/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify({ final_price: finalPrice }),
    })
  }

  async rejectNegotiation(id: string, note?: string) {
    return this.request<any>(`/negotiations/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ note }),
    })
  }

  // Orders
  async getOrders(params?: {
    order_status?: string
    payment_status?: string
    payment_method?: string
    search?: string
    page?: number
    limit?: number
    sort_by?: string
    sort_order?: string
  }) {
    const queryParams = new URLSearchParams()
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, String(value))
        }
      })
    }
    
    return this.request<{ orders: any[]; pagination: any }>(
      `/orders?${queryParams.toString()}`
    )
  }

  async createOrder(data: {
    product_id: string
    negotiation_id?: string
    payment_method: 'cod' | 'transfer' | 'ewallet'
    shipping_address: string
    note?: string
  }) {
    return this.request<any>('/orders', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateOrderStatus(id: string, status: string, adminNote?: string) {
    return this.request<any>(`/orders/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status, admin_note: adminNote }),
    })
  }

  // Notifications
  async getNotifications(params?: {
    unread?: boolean
    page?: number
    limit?: number
  }) {
    const queryParams = new URLSearchParams()
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, String(value))
        }
      })
    }
    
    return this.request<{ notifications: any[]; pagination: any }>(
      `/notifications?${queryParams.toString()}`
    )
  }

  async sendNotification(data: {
    user_id: string
    type: string
    title: string
    message: string
    data?: Record<string, any>
  }) {
    return this.request<any>('/notifications/send', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  // Users
  async getCurrentUser() {
    return this.request<any>('/users/me')
  }

  async getUsers(params?: {
    role?: string
    page?: number
    limit?: number
  }) {
    const queryParams = new URLSearchParams()
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, String(value))
        }
      })
    }
    
    return this.request<{ users: any[]; pagination: any }>(
      `/users?${queryParams.toString()}`
    )
  }

  // Activity Logs
  async getActivityLogs(params?: {
    admin_id?: string
    action?: string
    page?: number
    limit?: number
  }) {
    const queryParams = new URLSearchParams()
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, String(value))
        }
      })
    }
    
    return this.request<{ logs: any[]; pagination: any }>(
      `/activity?${queryParams.toString()}`
    )
  }
}

export const api = new ApiClient()
