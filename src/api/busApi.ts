import { mockBusApi } from '@/api/mockBusApi';
import { env } from '@/config/env';
import type { Arrival, BusRoute, BusStop, CityCode } from '@/types/bus';

/**
 * 화면이 사용하는 버스 데이터 인터페이스.
 *
 * 화면 코드는 이 파사드만 바라봅니다. 지금은 공공데이터포털 점검으로
 * 목데이터(mockBusApi)를 쓰고, 인증키 발급 후 TAGO 구현을 채운 뒤
 * env.useMockApi 를 false 로 바꾸면 그대로 실데이터로 전환됩니다.
 */
export type BusApi = {
  /** 정류장 이름/번호로 검색 */
  searchStops(keyword: string): Promise<BusStop[]>;
  /** 정류장을 지나는 노선 목록 */
  getRoutesAtStop(stop: BusStop): Promise<BusRoute[]>;
  /** 정류장의 전체 노선 도착정보 */
  getArrivals(cityCode: CityCode, nodeId: string): Promise<Arrival[]>;
};

function notLinked(): never {
  throw new Error(
    '공공데이터포털 API가 아직 연동되지 않았습니다. env.useMockApi 를 켜거나 tagoBusApi 를 구현하세요.',
  );
}

/** TAGO 실구현 자리. api/client.ts 의 api + unwrapItems 로 채웁니다. */
const tagoBusApi: BusApi = {
  async searchStops() {
    notLinked();
  },
  async getRoutesAtStop() {
    notLinked();
  },
  async getArrivals() {
    notLinked();
  },
};

export const busApi: BusApi = env.useMockApi ? mockBusApi : tagoBusApi;
