import { api } from '@/api/client';
import type { LoginRequest, LoginResponse, User } from '@/types/api';

export const authApi = {
  async login(body: LoginRequest): Promise<LoginResponse> {
    const res = await api.post<LoginResponse>('/auth/login', body);
    return res.data;
  },

  async me(): Promise<User> {
    const res = await api.get<User>('/auth/me');
    return res.data;
  },

  async logout(): Promise<void> {
    await api.post('/auth/logout');
  },
};
