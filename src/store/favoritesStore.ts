import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { DEFAULT_ALARM, type FavoriteAlarm } from '@/types/alarm';
import { favoriteId, type CityCode, type Favorite } from '@/types/bus';

type FavoritesState = {
  favorites: Favorite[];
  /** AsyncStorage 복원이 끝났는지 여부 (스플래시 분기용) */
  hydrated: boolean;
};

type NewFavorite = {
  cityCode: CityCode;
  nodeId: string;
  stopName: string;
  routeId: string;
  routeNo: string;
};

type FavoritesActions = {
  add: (input: NewFavorite) => void;
  remove: (id: string) => void;
  /** 드래그 정렬용. 목록 전체를 새 순서로 교체합니다. */
  reorder: (favorites: Favorite[]) => void;
  has: (cityCode: CityCode, nodeId: string, routeId: string) => boolean;
  /** 알림 설정 부분 수정 */
  updateAlarm: (id: string, patch: Partial<FavoriteAlarm>) => void;
};

export const useFavoritesStore = create<FavoritesState & FavoritesActions>()(
  persist(
    (set, get) => ({
      favorites: [],
      hydrated: false,

      add: input => {
        const id = favoriteId(input.cityCode, input.nodeId, input.routeId);
        if (get().favorites.some(f => f.id === id)) {
          return;
        }
        const favorite: Favorite = {
          id,
          ...input,
          alarm: { ...DEFAULT_ALARM, days: [...DEFAULT_ALARM.days] },
          createdAt: new Date().toISOString(),
        };
        set(state => ({ favorites: [...state.favorites, favorite] }));
      },

      remove: id =>
        set(state => ({
          favorites: state.favorites.filter(f => f.id !== id),
        })),

      reorder: favorites => set({ favorites }),

      has: (cityCode, nodeId, routeId) => {
        const id = favoriteId(cityCode, nodeId, routeId);
        return get().favorites.some(f => f.id === id);
      },

      updateAlarm: (id, patch) =>
        set(state => ({
          favorites: state.favorites.map(f =>
            f.id === id ? { ...f, alarm: { ...f.alarm, ...patch } } : f,
          ),
        })),
    }),
    {
      name: 'favorites',
      storage: createJSONStorage(() => AsyncStorage),
      // v1: 즐겨찾기에 알림 설정(alarm)이 추가됐습니다.
      version: 1,
      migrate: persisted => {
        const state = persisted as { favorites?: Favorite[] };
        return {
          favorites: (state.favorites ?? []).map(favorite => ({
            ...favorite,
            alarm: favorite.alarm ?? {
              ...DEFAULT_ALARM,
              days: [...DEFAULT_ALARM.days],
            },
          })),
        };
      },
      // hydrated 는 휘발성이라 저장하지 않습니다.
      partialize: state => ({ favorites: state.favorites }),
      onRehydrateStorage: () => () => {
        useFavoritesStore.setState({ hydrated: true });
      },
    },
  ),
);

export const selectFavorites = (state: FavoritesState) => state.favorites;
