import type { BusApi } from '@/api/busApi';
import { api, unwrapItems } from '@/api/client';
import { currentCity } from '@/store/settingsStore';
import type { Arrival, BusRoute, BusStop, City, CityCode } from '@/types/bus';

/**
 * 공공데이터포털(TAGO) 실구현.
 *
 * 응답 필드는 전부 소문자(nodeid, routeno, arrtime ...)이고 숫자로 내려오는
 * 필드가 섞여 있어서, 여기서 @/types/bus 모델로 정규화합니다.
 *
 * ── 요청 파라미터 대소문자 (실제 응답으로 확인함) ──────────────────
 * 서비스마다 규칙이 다르고, 틀려도 에러가 나지 않습니다.
 *
 *   ArvlInfoInqireService  →  nodeId, routeId  (카멜케이스)
 *   getSttnThrghRouteList  →  nodeid           (전부 소문자)
 *
 * `getSttnThrghRouteList` 에 `nodeId` 로 보내면 resultCode 는 00 인데
 * 정류소 필터가 조용히 무시되고 도시 전체 노선이 돌아옵니다. 반대로
 * 도착정보에 `nodeid` 로 보내면 결과가 0건이 됩니다. 둘 다 예외가 없으니
 * 아래 파라미터 이름을 바꾸지 마세요.
 */

const STOP_SERVICE = '/BusSttnInfoInqireService';
const ARRIVAL_SERVICE = '/ArvlInfoInqireService';

/** TAGO 기본값은 10건이라 목록 조회에는 넉넉히 요청합니다. */
const DEFAULT_ROWS = 50;

type RawCity = {
  citycode: number;
  cityname: string;
};

type RawStop = {
  nodeid: string;
  nodenm: string;
  /** 숫자(32350)로 올 때도, 앞자리 0이 붙은 문자열("031056")로 올 때도 있습니다. */
  nodeno?: number | string;
  gpslati?: number;
  gpslong?: number;
  citycode?: number;
};

type RawRoute = {
  routeid: string;
  routeno: number | string;
  routetp?: string;
  startnodenm?: string;
  endnodenm?: string;
};

type RawArrival = {
  routeid: string;
  routeno: number | string;
  routetp?: string;
  /** 도착까지 남은 초 */
  arrtime: number | string;
  /** 남은 정류장 수 */
  arrprevstationcnt?: number | string;
};

/** 숫자로 오는 필드(routeno, nodeno)를 문자열로 통일합니다. */
function text(value: string | number | undefined | null): string | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  return String(value);
}

function count(value: string | number | undefined | null): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toStop(raw: RawStop, fallbackCityCode: CityCode): BusStop {
  return {
    nodeId: raw.nodeid,
    name: raw.nodenm,
    number: text(raw.nodeno),
    cityCode: raw.citycode ?? fallbackCityCode,
    lat: raw.gpslati,
    lng: raw.gpslong,
  };
}

function toRoute(raw: RawRoute): BusRoute {
  return {
    routeId: raw.routeid,
    routeNo: text(raw.routeno) ?? '',
    routeType: raw.routetp,
  };
}

function toArrival(raw: RawArrival): Arrival {
  return {
    routeId: raw.routeid,
    routeNo: text(raw.routeno) ?? '',
    secondsLeft: count(raw.arrtime),
    stopsLeft:
      raw.arrprevstationcnt === undefined
        ? undefined
        : count(raw.arrprevstationcnt),
  };
}

async function fetchItems<T>(
  path: string,
  params: Record<string, unknown>,
): Promise<T[]> {
  const { data } = await api.get(path, {
    params: { pageNo: 1, numOfRows: DEFAULT_ROWS, ...params },
  });
  return unwrapItems<T>(data);
}

/** 도시목록은 140여 건이고 거의 바뀌지 않아 앱 실행당 한 번만 받습니다. */
let cityCache: City[] | null = null;

/**
 * TAGO 가 지원하는 도시코드 목록. 도시 선택 UI 에서 씁니다.
 *
 * 서울(11)은 이 목록에 없습니다. 서울 버스는 서울시 별도 오픈API 가 필요합니다.
 */
export async function getCityCodes(): Promise<City[]> {
  if (cityCache) {
    return cityCache;
  }
  const rows = await fetchItems<RawCity>(`${STOP_SERVICE}/getCtyCodeList`, {});
  cityCache = rows.map(raw => ({ code: raw.citycode, name: raw.cityname }));
  return cityCache;
}

/**
 * 좌표 근처의 정류소. 응답에 citycode 가 들어 있어 도시를 몰라도 조회됩니다.
 * "내 주변 정류장" 을 붙일 때 씁니다.
 */
export async function getNearbyStops(
  lat: number,
  lng: number,
): Promise<BusStop[]> {
  const rows = await fetchItems<RawStop>(
    `${STOP_SERVICE}/getCrdntPrxmtSttnList`,
    { gpsLati: lat, gpsLong: lng },
  );
  return rows.map(raw => toStop(raw, currentCity().code));
}

/**
 * 정류소 + 노선을 지정한 도착정보 1건.
 *
 * 즐겨찾기 한 줄만 갱신할 때 `getArrivals` 보다 응답이 가볍습니다.
 * 해당 노선이 운행 중이 아니면 null 입니다.
 */
export async function getArrivalForRoute(
  cityCode: CityCode,
  nodeId: string,
  routeId: string,
): Promise<Arrival | null> {
  const rows = await fetchItems<RawArrival>(
    `${ARRIVAL_SERVICE}/getSttnAcctoSpcifyRouteBusArvlPrearngeInfoList`,
    { cityCode, nodeId, routeId },
  );
  return rows.length > 0 ? toArrival(rows[0]) : null;
}

export const tagoBusApi: BusApi = {
  async searchStops(keyword: string): Promise<BusStop[]> {
    const query = keyword.trim();
    if (!query) {
      return [];
    }

    // 숫자만 입력하면 정류소 번호로, 아니면 정류소명으로 찾습니다.
    // nodeNm 은 부분일치라 "시청" 으로 "대전광역시청" 까지 걸립니다.
    const byNumber = /^\d+$/.test(query);
    // 검색 지역은 설정에서 고른 도시입니다. (settingsStore)
    const cityCode = currentCity().code;

    const rows = await fetchItems<RawStop>(`${STOP_SERVICE}/getSttnNoList`, {
      cityCode,
      ...(byNumber ? { nodeNo: query } : { nodeNm: query }),
    });
    return rows.map(raw => toStop(raw, cityCode));
  },

  async getRoutesAtStop(stop: BusStop): Promise<BusRoute[]> {
    const rows = await fetchItems<RawRoute>(
      `${STOP_SERVICE}/getSttnThrghRouteList`,
      {
        cityCode: stop.cityCode,
        // 소문자여야 합니다. 위 주석 참고.
        nodeid: stop.nodeId,
      },
    );
    return rows.map(toRoute);
  },

  async getArrivals(cityCode: CityCode, nodeId: string): Promise<Arrival[]> {
    const rows = await fetchItems<RawArrival>(
      `${ARRIVAL_SERVICE}/getSttnAcctoArvlPrearngeInfoList`,
      {
        cityCode,
        // 카멜케이스여야 합니다. 위 주석 참고.
        nodeId,
      },
    );
    return rows
      .map(toArrival)
      .sort((a, b) => a.secondsLeft - b.secondsLeft);
  },
};
