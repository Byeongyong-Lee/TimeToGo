import type { NavigatorScreenParams } from '@react-navigation/native';

import type { BusStop } from '@/types/bus';

export type MainTabParamList = {
  /** 즐겨찾기한 정류장·노선의 도착시간. 앱을 켜면 바로 이 화면입니다. */
  Favorites: undefined;
  Settings: undefined;
};

export type RootStackParamList = {
  MainTabs: NavigatorScreenParams<MainTabParamList>;
  /** 정류장 이름/번호 검색 */
  StopSearch: undefined;
  /** 검색한 정류장의 노선 목록. 여기서 즐겨찾기에 등록합니다. */
  StopRoutes: { stop: BusStop };
  /** 즐겨찾기 하나의 알림 세부 설정 (요일·시간대·주기) */
  FavoriteAlarm: { favoriteId: string };
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
