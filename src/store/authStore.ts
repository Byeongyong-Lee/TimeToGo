import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { authApi } from '@/api/auth';
import { setAuthHandlers, toErrorMessage } from '@/api/client';
import type { User } from '@/types/api';

type AuthState = {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  /** AsyncStorage 복원이 끝났는지 여부 (스플래시 분기용) */
  hydrated: boolean;
  loading: boolean;
  error: string | null;
};

type AuthActions = {
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  setTokens: (accessToken: string, refreshToken: string) => void;
  clearError: () => void;
};

const initialState: AuthState = {
  user: null,
  accessToken: null,
  refreshToken: null,
  hydrated: false,
  loading: false,
  error: null,
};

export const useAuthStore = create<AuthState & AuthActions>()(
  persist(
    (set, get) => ({
      ...initialState,

      login: async (email, password) => {
        set({ loading: true, error: null });
        try {
          const { user, accessToken, refreshToken } = await authApi.login({
            email,
            password,
          });
          set({ user, accessToken, refreshToken, loading: false });
          return true;
        } catch (error) {
          set({ loading: false, error: toErrorMessage(error) });
          return false;
        }
      },

      logout: async () => {
        try {
          if (get().accessToken) {
            await authApi.logout();
          }
        } catch {
          // 서버 로그아웃이 실패해도 로컬 세션은 정리합니다.
        } finally {
          set({ user: null, accessToken: null, refreshToken: null });
        }
      },

      setTokens: (accessToken, refreshToken) =>
        set({ accessToken, refreshToken }),

      clearError: () => set({ error: null }),
    }),
    {
      name: 'auth',
      storage: createJSONStorage(() => AsyncStorage),
      // 토큰과 유저만 저장하고, loading/error 같은 휘발성 상태는 제외합니다.
      partialize: state => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
      }),
      onRehydrateStorage: () => () => {
        useAuthStore.setState({ hydrated: true });
      },
    },
  ),
);

export const selectIsLoggedIn = (state: AuthState) =>
  Boolean(state.accessToken);

/**
 * api 클라이언트와 auth 스토어를 연결합니다.
 * App 컴포넌트에서 최초 1회 호출됩니다.
 */
export function connectAuthToApiClient() {
  setAuthHandlers({
    getAccessToken: () => useAuthStore.getState().accessToken,
    getRefreshToken: () => useAuthStore.getState().refreshToken,
    onRefreshed: (accessToken, refreshToken) =>
      useAuthStore.getState().setTokens(accessToken, refreshToken),
    onAuthFailed: () => {
      useAuthStore.setState({
        user: null,
        accessToken: null,
        refreshToken: null,
      });
    },
  });
}
