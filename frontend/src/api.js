/**
 * API client library
 * Respects REACT_APP_BACKEND_URL per p.md line 31
 */
const RAW_BASE_URL = 
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_BACKEND_URL) ||
  (typeof process !== 'undefined' && process.env && process.env.REACT_APP_BACKEND_URL) ||
  (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && !window.location.hostname.includes('127.0.0.1')
    ? 'https://pgbooking-api.onrender.com'
    : '');

const BASE_URL = RAW_BASE_URL.replace(/\/+$/, '');
export const API_BASE = BASE_URL ? `${BASE_URL}/api` : '/api';

export function getAuthToken() {
  return localStorage.getItem('pgbooking_token');
}

export function setAuthToken(token) {
  if (token) {
    localStorage.setItem('pgbooking_token', token);
  } else {
    localStorage.removeItem('pgbooking_token');
  }
}

async function request(endpoint, options = {}) {
  const token = getAuthToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 204) {
    return null;
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const errorMsg = data?.detail || data?.message || `Request failed with status ${response.status}`;
    const err = new Error(errorMsg);
    err.status = response.status;
    err.data = data;
    throw err;
  }

  if (data === null && response.status !== 204) {
    throw new Error('Received unexpected non-JSON response from server.');
  }

  return data;
}

export const api = {
  // Auth
  register: (payload) => request('/auth/register', { method: 'POST', body: JSON.stringify(payload) }),
  login: (payload) => request('/auth/login', { method: 'POST', body: JSON.stringify(payload) }),
  forgotPassword: (payload) => request('/auth/forgot-password', { method: 'POST', body: JSON.stringify(payload) }),
  resetPassword: (payload) => request('/auth/reset-password', { method: 'POST', body: JSON.stringify(payload) }),
  getMe: () => request('/auth/me'),
  updateProfile: (payload) => request('/auth/profile', { method: 'PUT', body: JSON.stringify(payload) }),

  // Properties
  getProperties: (params = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') query.append(k, v);
    });
    return request(`/properties?${query.toString()}`);
  },
  getFeaturedProperties: () => request('/properties/featured'),
  getCitiesStats: () => request('/properties/cities-stats'),
  getProperty: (id) => request(`/properties/${id}`),
  createProperty: (payload) => request('/properties', { method: 'POST', body: JSON.stringify(payload) }),
  updateProperty: (id, payload) => request(`/properties/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteProperty: (id) => request(`/properties/${id}`, { method: 'DELETE' }),
  boostProperty: (id) => request(`/properties/${id}/boost`, { method: 'POST' }),
  getMyProperties: () => request('/properties/owner/my-properties'),

  // Bookings & Bed Locks
  lockBed: (payload) => request('/bookings/lock-bed', { method: 'POST', body: JSON.stringify(payload) }),
  unlockBed: (payload) => request('/bookings/unlock-bed', { method: 'POST', body: JSON.stringify(payload) }),
  initiateBooking: (payload) => request('/bookings/initiate', { method: 'POST', body: JSON.stringify(payload) }),
  confirmBooking: (id, payload = {}) => request(`/bookings/${id}/confirm`, { method: 'POST', body: JSON.stringify(payload) }),
  cancelBooking: (id, payload = {}) => request(`/bookings/${id}/cancel`, { method: 'POST', body: JSON.stringify(payload) }),
  processRefund: (id, payload = {}) => request(`/bookings/${id}/process-refund`, { method: 'POST', body: JSON.stringify(payload) }),
  getMyBookings: () => request('/bookings/mine'),
  getOwnerBookings: () => request('/bookings/owner'),
  getBooking: (id) => request(`/bookings/${id}`),

  // Payments (Stripe)
  createCheckoutSession: (payload) => request('/payments/create-checkout-session', { method: 'POST', body: JSON.stringify(payload) }),
  confirmTestPayment: (payload) => request('/payments/confirm-test-payment', { method: 'POST', body: JSON.stringify(payload) }),

  // AI Assistant
  askRecommendation: (payload) => request('/ai/recommend', { method: 'POST', body: JSON.stringify(payload) }),
};
