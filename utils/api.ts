/**
 * utils/api.ts
 *
 * Single API client for the entire app.
 * Wraps axios (already configured in AuthContext) so all hooks get
 * authentication headers for free — no duplication.
 *
 * Usage:
 *   import api from '@/utils/api';
 *   const data = await api.get<Booking[]>('/api/bookings');
 *   await api.post('/api/bookings', payload);
 */
import axios from 'axios';

const BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? 'https://jw-auto-clinic-246.onrender.com';

// Keep in sync with AuthContext's axios setup
axios.defaults.baseURL = BASE_URL;
axios.defaults.headers.common['Accept'] = 'application/json';

class ApiClient {
  async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    endpoint: string,
    body?: object,
  ): Promise<T> {
    const res = await axios.request<T>({
      method,
      url: endpoint,
      data: body,
    });
    return res.data;
  }

  get<T>(endpoint: string): Promise<T> {
    return this.request<T>('GET', endpoint);
  }

  post<T>(endpoint: string, body: object): Promise<T> {
    return this.request<T>('POST', endpoint, body);
  }

  put<T>(endpoint: string, body: object): Promise<T> {
    return this.request<T>('PUT', endpoint, body);
  }

  patch<T>(endpoint: string, body: object): Promise<T> {
    return this.request<T>('PATCH', endpoint, body);
  }

  delete<T>(endpoint: string): Promise<T> {
    return this.request<T>('DELETE', endpoint);
  }
}

export const api = new ApiClient();
export default api;
