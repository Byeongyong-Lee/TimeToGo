import type { Arrival, BusRoute, BusStop, CityCode } from '@/types/bus';

/**
 * 공공데이터포털 연동 전까지 화면 개발용으로 쓰는 샘플 데이터.
 *
 * 실제 TAGO 응답을 정규화한 뒤의 모양(@/types/bus)과 동일한 형태를 돌려주므로,
 * API 를 붙일 때 화면 코드는 그대로 두고 busApi 구현만 갈아끼우면 됩니다.
 * 대전(도시코드 25)의 실제 정류장 이름을 본떴지만 ID·도착시간은 가짜입니다.
 */

const CITY_CODE: CityCode = 25;

const STOPS: BusStop[] = [
  { nodeId: 'DJB8001001', name: '대전역', number: '10940', cityCode: CITY_CODE },
  { nodeId: 'DJB8001002', name: '대전역네거리', number: '10950', cityCode: CITY_CODE },
  { nodeId: 'DJB8001003', name: '중앙로역', number: '11330', cityCode: CITY_CODE },
  { nodeId: 'DJB8001004', name: '시청', number: '21120', cityCode: CITY_CODE },
  { nodeId: 'DJB8001005', name: '시청·교육청', number: '21130', cityCode: CITY_CODE },
  { nodeId: 'DJB8001006', name: '정부청사역', number: '22240', cityCode: CITY_CODE },
  { nodeId: 'DJB8001007', name: '유성온천역', number: '31150', cityCode: CITY_CODE },
  { nodeId: 'DJB8001008', name: '충남대학교', number: '31240', cityCode: CITY_CODE },
  { nodeId: 'DJB8001009', name: '갈마역', number: '21550', cityCode: CITY_CODE },
  { nodeId: 'DJB8001010', name: '탄방역', number: '21470', cityCode: CITY_CODE },
];

const ROUTES: Record<string, BusRoute> = {
  DJB30300102: { routeId: 'DJB30300102', routeNo: '102', routeType: '간선버스' },
  DJB30300106: { routeId: 'DJB30300106', routeNo: '106', routeType: '간선버스' },
  DJB30300108: { routeId: 'DJB30300108', routeNo: '108', routeType: '간선버스' },
  DJB30300201: { routeId: 'DJB30300201', routeNo: '201', routeType: '간선버스' },
  DJB30300301: { routeId: 'DJB30300301', routeNo: '301', routeType: '간선버스' },
  DJB30300311: { routeId: 'DJB30300311', routeNo: '311', routeType: '간선버스' },
  DJB30300613: { routeId: 'DJB30300613', routeNo: '613', routeType: '지선버스' },
  DJB30300618: { routeId: 'DJB30300618', routeNo: '618', routeType: '지선버스' },
  DJB30300911: { routeId: 'DJB30300911', routeNo: '급행1', routeType: '급행버스' },
  DJB30300912: { routeId: 'DJB30300912', routeNo: '급행2', routeType: '급행버스' },
};

/** 정류장별로 지나가는 노선 목록 */
const ROUTES_AT_STOP: Record<string, string[]> = {
  DJB8001001: ['DJB30300102', 'DJB30300201', 'DJB30300613', 'DJB30300911'],
  DJB8001002: ['DJB30300102', 'DJB30300106', 'DJB30300201'],
  DJB8001003: ['DJB30300106', 'DJB30300301', 'DJB30300618'],
  DJB8001004: ['DJB30300108', 'DJB30300311', 'DJB30300912'],
  DJB8001005: ['DJB30300108', 'DJB30300301', 'DJB30300311', 'DJB30300912'],
  DJB8001006: ['DJB30300102', 'DJB30300108', 'DJB30300911', 'DJB30300912'],
  DJB8001007: ['DJB30300106', 'DJB30300301', 'DJB30300911'],
  DJB8001008: ['DJB30300301', 'DJB30300613', 'DJB30300618'],
  DJB8001009: ['DJB30300201', 'DJB30300311', 'DJB30300618'],
  DJB8001010: ['DJB30300102', 'DJB30300311', 'DJB30300912'],
};

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function randomBetween(min: number, max: number): number {
  return Math.floor(min + Math.random() * (max - min));
}

/** 실제 네트워크처럼 느껴지도록 응답을 약간 지연시킵니다. */
function networkDelay(): Promise<void> {
  return delay(randomBetween(250, 600));
}

export const mockBusApi = {
  async searchStops(keyword: string): Promise<BusStop[]> {
    await networkDelay();
    const query = keyword.replace(/\s/g, '');
    if (!query) {
      return [];
    }
    return STOPS.filter(
      stop =>
        stop.name.replace(/\s/g, '').includes(query) ||
        stop.number?.includes(query),
    );
  },

  async getRoutesAtStop(stop: BusStop): Promise<BusRoute[]> {
    await networkDelay();
    return (ROUTES_AT_STOP[stop.nodeId] ?? []).map(routeId => ROUTES[routeId]);
  },

  async getArrivals(_cityCode: CityCode, nodeId: string): Promise<Arrival[]> {
    await networkDelay();
    const arrivals: Arrival[] = [];
    for (const routeId of ROUTES_AT_STOP[nodeId] ?? []) {
      const route = ROUTES[routeId];
      // 일부 노선은 도착 정보가 없는 상황(막차 지남 등)도 흉내냅니다.
      const count = Math.random() < 0.15 ? 0 : Math.random() < 0.6 ? 2 : 1;
      let secondsLeft = 0;
      for (let i = 0; i < count; i += 1) {
        secondsLeft += randomBetween(40, 900);
        arrivals.push({
          routeId,
          routeNo: route.routeNo,
          secondsLeft,
          stopsLeft: Math.max(1, Math.round(secondsLeft / 95)),
        });
      }
    }
    return arrivals.sort((a, b) => a.secondsLeft - b.secondsLeft);
  },
};
