import axios, {
  AxiosError,
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from 'axios';

import { env } from '@/config/env';

/**
 * 앱 전역에서 쓰는 axios 인스턴스.
 *
 * - 요청 인터셉터: 토큰이 있으면 Authorization 헤더를 붙임
 * - 응답 인터셉터: 401 이면 refresh 를 1회 시도하고, 실패하면 로그아웃 콜백 호출
 *
 * 순환 참조를 피하려고 store 를 직접 import 하지 않고
 * setAuthHandlers() 로 주입받습니다. (App 부팅 시 1회 호출)
 */

type AuthHandlers = {
  getAccessToken: () => string | null;
  getRefreshToken: () => string | null;
  onRefreshed: (accessToken: string, refreshToken: string) => void;
  onAuthFailed: () => void;
};

let handlers: AuthHandlers = {
  getAccessToken: () => null,
  getRefreshToken: () => null,
  onRefreshed: () => {},
  onAuthFailed: () => {},
};

export function setAuthHandlers(next: AuthHandlers) {
  handlers = next;
}

export const api: AxiosInstance = axios.create({
  baseURL: env.apiBaseUrl,
  timeout: env.timeout,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = handlers.getAccessToken();
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }
  return config;
});

type RetriableConfig = InternalAxiosRequestConfig & { _retried?: boolean };

/** 동시에 여러 요청이 401 을 받아도 refresh 는 한 번만 돌도록 묶어둡니다. */
let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  const refreshToken = handlers.getRefreshToken();
  if (!refreshToken) {
    throw new Error('no refresh token');
  }

  // 인터셉터가 다시 걸리지 않도록 별도의 순수 axios 인스턴스를 사용합니다.
  const res = await axios.post<{ accessToken: string; refreshToken: string }>(
    `${env.apiBaseUrl}/auth/refresh`,
    { refreshToken },
    { timeout: env.timeout },
  );

  handlers.onRefreshed(res.data.accessToken, res.data.refreshToken);
  return res.data.accessToken;
}

api.interceptors.response.use(
  response => response,
  async (error: AxiosError) => {
    const config = error.config as RetriableConfig | undefined;

    if (error.response?.status !== 401 || !config || config._retried) {
      return Promise.reject(error);
    }

    config._retried = true;

    try {
      refreshPromise = refreshPromise ?? refreshAccessToken();
      const accessToken = await refreshPromise;
      config.headers.set('Authorization', `Bearer ${accessToken}`);
      return api.request(config);
    } catch (refreshError) {
      handlers.onAuthFailed();
      return Promise.reject(refreshError);
    } finally {
      refreshPromise = null;
    }
  },
);

/** 화면에 바로 보여줄 수 있는 에러 메시지로 정규화합니다. */
export function toErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    if (error.code === 'ECONNABORTED') {
      return '요청 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.';
    }
    if (!error.response) {
      return '네트워크에 연결할 수 없습니다.';
    }
    const data = error.response.data as { message?: string } | undefined;
    return data?.message ?? `요청에 실패했습니다. (${error.response.status})`;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return '알 수 없는 오류가 발생했습니다.';
}
