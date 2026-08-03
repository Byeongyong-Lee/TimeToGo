import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { env } from '@/config/env';
import type { City, CityCode } from '@/types/bus';

/**
 * 앱 전역 설정.
 *
 * 지금은 "정류장을 검색할 지역" 하나뿐입니다. TAGO 정류소 검색은 도시코드가
 * 필수인데 사용자는 보통 한 지역에서만 버스를 타므로, 매번 고르게 하지 않고
 * 한 번 고른 값을 저장해서 씁니다.
 *
 * 즐겨찾기는 각자 cityCode 를 들고 있으므로(@/types/bus 의 Favorite), 여기서
 * 지역을 바꿔도 이미 등록한 즐겨찾기의 도착정보는 그대로 조회됩니다.
 */
type SettingsState = {
  cityCode: CityCode;
  /**
   * 도시 이름 스냅샷.
   * 이름만 보여주려고 매번 도시목록(140여 건)을 다시 받지 않기 위해 저장합니다.
   */
  cityName: string;
  /** AsyncStorage 복원이 끝났는지 여부 */
  hydrated: boolean;
};

type SettingsActions = {
  setCity: (city: City) => void;
};

export const useSettingsStore = create<SettingsState & SettingsActions>()(
  persist(
    set => ({
      cityCode: env.defaultCity.code,
      cityName: env.defaultCity.name,
      hydrated: false,

      setCity: city => set({ cityCode: city.code, cityName: city.name }),
    }),
    {
      name: 'settings',
      storage: createJSONStorage(() => AsyncStorage),
      // hydrated 는 휘발성이라 저장하지 않습니다.
      partialize: state => ({
        cityCode: state.cityCode,
        cityName: state.cityName,
      }),
      onRehydrateStorage: () => () => {
        useSettingsStore.setState({ hydrated: true });
      },
    },
  ),
);

export const selectCityCode = (state: SettingsState) => state.cityCode;
export const selectCityName = (state: SettingsState) => state.cityName;

/**
 * React 밖(api 레이어)에서 현재 지역을 읽을 때 씁니다.
 * 복원 전이면 기본값이 나옵니다.
 */
export function currentCity(): City {
  const { cityCode, cityName } = useSettingsStore.getState();
  return { code: cityCode, name: cityName };
}
