import { mockBusApi } from '@/api/mockBusApi';
import { tagoBusApi } from '@/api/tagoBusApi';
import { env } from '@/config/env';
import type { Arrival, BusRoute, BusStop, CityCode } from '@/types/bus';

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

export const busApi: BusApi = env.useMockApi ? mockBusApi : tagoBusApi;
