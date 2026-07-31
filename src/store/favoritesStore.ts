import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

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
    }),
    {
      name: 'favorites',
      storage: createJSONStorage(() => AsyncStorage),
      // hydrated 는 휘발성이라 저장하지 않습니다.
      partialize: state => ({ favorites: state.favorites }),
      onRehydrateStorage: () => () => {
        useFavoritesStore.setState({ hydrated: true });
      },
    },
  ),
);

export const selectFavorites = (state: FavoritesState) => state.favorites;
