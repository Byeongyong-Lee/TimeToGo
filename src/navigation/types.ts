import type { NavigatorScreenParams } from '@react-navigation/native';

export type MainTabParamList = {
  /** 즐겨찾기한 정류장·노선의 도착시간. 앱을 켜면 바로 이 화면입니다. */
  Favorites: undefined;
  Settings: undefined;
};

export type RootStackParamList = {
  MainTabs: NavigatorScreenParams<MainTabParamList>;
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
