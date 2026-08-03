import { mockBusApi } from '@/api/mockBusApi';
import { seoulBusApi } from '@/api/seoulBusApi';
import { tagoBusApi } from '@/api/tagoBusApi';
import { env } from '@/config/env';
import { currentCity } from '@/store/settingsStore';
import type { Arrival, BusRoute, BusStop, CityCode } from '@/types/bus';
import { isSeoul } from '@/types/bus';

/**
 * 화면이 사용하는 버스 데이터 인터페이스.
 *
 * 화면 코드는 이 파사드만 바라봅니다. 기본은 TAGO 실데이터(tagoBusApi)이고,
 * env.useMockApi 를 켜면 네트워크 없이 목데이터로 돌아갑니다.
 */
export type BusApi = {
  /** 정류장 이름/번호로 검색 */
  searchStops(keyword: string): Promise<BusStop[]>;
  /** 정류장을 지나는 노선 목록 */
  getRoutesAtStop(stop: BusStop): Promise<BusRoute[]>;
  /** 정류장의 전체 노선 도착정보 */
  getArrivals(cityCode: CityCode, nodeId: string): Promise<Arrival[]>;
};

/**
 * 도시코드로 제공자를 고릅니다.
 *
 * 서울(11)은 TAGO 에 없어서 서울시 별도 API 를 씁니다. 즐겨찾기는 각자
 * cityCode 를 들고 있으므로, 지금 설정된 지역이 어디든 서울 즐겨찾기는 계속
 * 서울 API 로 조회됩니다.
 */
function providerFor(cityCode: CityCode): BusApi {
  if (env.useMockApi) {
    return mockBusApi;
  }
  return isSeoul(cityCode) ? seoulBusApi : tagoBusApi;
}

export const busApi: BusApi = {
  searchStops(keyword: string): Promise<BusStop[]> {
    // 검색만 도시코드 인자가 없습니다. 설정에서 고른 지역으로 가릅니다.
    return providerFor(currentCity().code).searchStops(keyword);
  },

  getRoutesAtStop(stop: BusStop): Promise<BusRoute[]> {
    return providerFor(stop.cityCode).getRoutesAtStop(stop);
  },

  getArrivals(cityCode: CityCode, nodeId: string): Promise<Arrival[]> {
    return providerFor(cityCode).getArrivals(cityCode, nodeId);
  },
};
