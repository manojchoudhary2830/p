import { apiClient } from '../interceptors/axios.interceptor';

// ─────────────────────────────────────────────
// Auth API
// ─────────────────────────────────────────────

export const authApi = {
  sendOtp: (phoneNumber: string) =>
    apiClient.post('/auth/otp/send', { phone_number: phoneNumber }),

  verifyOtp: (phoneNumber: string, otp: string, deviceInfo?: object) =>
    apiClient.post('/auth/otp/verify', { phone_number: phoneNumber, otp, device_info: deviceInfo }),

  refreshToken: (refreshToken: string) =>
    apiClient.post('/auth/token/refresh', { refresh_token: refreshToken }),

  logout: () => apiClient.post('/auth/logout'),

  getMe: () => apiClient.get('/auth/me'),

  completeProfile: (data: { legal_full_name: string; email_address?: string }) =>
    apiClient.patch('/auth/profile', data),
};

// ─────────────────────────────────────────────
// Properties API
// ─────────────────────────────────────────────

export const propertiesApi = {
  search: (params: {
    lat: number; lng: number; radius_km?: number;
    gender_policy?: string; min_rent?: number; max_rent?: number;
    amenities?: string; page?: number; limit?: number;
  }) => apiClient.get('/properties/search', { params }),

  getById: (id: string) => apiClient.get(`/properties/${id}`),

  getMyProperties: (page = 1, limit = 20) =>
    apiClient.get('/properties/mine', { params: { page, limit } }),

  create: (data: object) => apiClient.post('/properties', data),
  update: (id: string, data: object) => apiClient.put(`/properties/${id}`, data),
  delete: (id: string) => apiClient.delete(`/properties/${id}`),

  uploadPhoto: (id: string, formData: FormData) =>
    apiClient.post(`/properties/${id}/photos`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  toggleFavorite: (id: string) => apiClient.post(`/properties/${id}/favorites`),
  getFavorites: () => apiClient.get('/properties/favorites'),
};

// ─────────────────────────────────────────────
// Rooms & Beds API
// ─────────────────────────────────────────────

export const roomsApi = {
  list: (propertyId: string) => apiClient.get(`/properties/${propertyId}/rooms`),
  get: (propertyId: string, roomId: string) =>
    apiClient.get(`/properties/${propertyId}/rooms/${roomId}`),
  create: (propertyId: string, data: object) =>
    apiClient.post(`/properties/${propertyId}/rooms`, data),
  update: (propertyId: string, roomId: string, data: object) =>
    apiClient.put(`/properties/${propertyId}/rooms/${roomId}`, data),
  delete: (propertyId: string, roomId: string) =>
    apiClient.delete(`/properties/${propertyId}/rooms/${roomId}`),
};

export const bedsApi = {
  list: (roomId: string) => apiClient.get(`/rooms/${roomId}/beds`),
  create: (roomId: string, beds: { bed_spatial_code: string }[]) =>
    apiClient.post(`/rooms/${roomId}/beds`, { beds }),
  delete: (roomId: string, bedId: string) =>
    apiClient.delete(`/rooms/${roomId}/beds/${bedId}`),
};

// ─────────────────────────────────────────────
// Bookings API
// ─────────────────────────────────────────────

export const bookingsApi = {
  initiate: (data: { bed_id: string; intended_check_in: string }, idempotencyKey?: string) =>
    apiClient.post('/bookings', data, {
      headers: idempotencyKey ? { 'X-Idempotency-Key': idempotencyKey } : {},
    }),

  getMyBookings: (page = 1) => apiClient.get('/bookings/mine', { params: { page } }),
  getById: (id: string) => apiClient.get(`/bookings/${id}`),
  cancel: (id: string, reason?: string) => apiClient.post(`/bookings/${id}/cancel`, { reason }),

  // Owner
  getOwnerBookings: (page = 1, status?: string) =>
    apiClient.get('/bookings/owner', { params: { page, status } }),
  checkout: (id: string, data: { actual_check_out_date: string; checkout_notes?: string }) =>
    apiClient.post(`/bookings/${id}/checkout`, data),
};

// ─────────────────────────────────────────────
// Payments API
// ─────────────────────────────────────────────

export const paymentsApi = {
  createOrder: (bookingId: string, purpose = 'TOKEN_DEPOSIT', idempotencyKey?: string) =>
    apiClient.post('/payments/orders', {
      booking_id: bookingId,
      purpose,
      idempotency_key: idempotencyKey,
    }),

  verifyPayment: (data: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
    booking_id: string;
  }) => apiClient.post('/payments/verify', data),

  getMyPayments: (page = 1) => apiClient.get('/payments/mine', { params: { page } }),
  getBookingPayments: (bookingId: string) => apiClient.get(`/payments/bookings/${bookingId}`),
};

// ─────────────────────────────────────────────
// Maintenance API
// ─────────────────────────────────────────────

export const maintenanceApi = {
  getMyTickets: () => apiClient.get('/maintenance/mine'),
  getTicket: (id: string) => apiClient.get(`/maintenance/${id}`),
  create: (formData: FormData) =>
    apiClient.post('/maintenance', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  updateStatus: (id: string, status: string, notes?: string) =>
    apiClient.patch(`/maintenance/${id}/status`, { status, resolution_notes: notes }),
  addComment: (id: string, content: string, isInternal = false) =>
    apiClient.post(`/maintenance/${id}/comments`, { content, is_internal: isInternal }),

  // Owner
  getOwnerTickets: (page = 1, status?: string) =>
    apiClient.get('/maintenance/owner', { params: { page, status } }),
};

// ─────────────────────────────────────────────
// Notifications API
// ─────────────────────────────────────────────

export const notificationsApi = {
  getAll: (page = 1, unreadOnly = false) =>
    apiClient.get('/notifications', { params: { page, unread: unreadOnly } }),
  getUnreadCount: () => apiClient.get('/notifications/unread-count'),
  markRead: (ids: string[]) => apiClient.post('/notifications/mark-read', { ids }),
  markAllRead: () => apiClient.post('/notifications/mark-all-read'),
  updateFcmToken: (fcmToken: string) => apiClient.put('/notifications/fcm-token', { fcm_token: fcmToken }),
};

// ─────────────────────────────────────────────
// Owner Dashboard API
// ─────────────────────────────────────────────

export const ownerApi = {
  getDashboard: () => apiClient.get('/owner/dashboard'),
  getRevenue: (months = 6) => apiClient.get('/owner/revenue', { params: { months } }),
  getTenants: (page = 1) => apiClient.get('/owner/tenants', { params: { page } }),
  getRentDue: () => apiClient.get('/owner/rent-due'),
};
