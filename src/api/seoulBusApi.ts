import type { BusApi } from '@/api/busApi';
import { seoulApi, unwrapSeoulItems } from '@/api/seoulClient';
import type { Arrival, BusRoute, BusStop, CityCode } from '@/types/bus';
import { SEOUL_CITY_CODE } from '@/types/bus';

/**
 * 서울시 버스 API(ws.bus.go.kr) 실구현.
 *
 * TAGO 와 다른 점이 세 가지 있어서 별도 모듈로 뒀습니다.
 *
 * 1. 응답 키가 카멜케이스입니다. (stNm, busRouteId, arrmsg1 ...)
 * 2. 정류소를 가리키는 ID 가 두 개입니다. 아래 "arsId 를 nodeId 로 쓰는 이유" 참고.
 * 3. 도착정보 전용 엔드포인트가 따로 없고, 정류소 조회(getStationByUid) 응답에
 *    도착정보가 같이 들어옵니다.
 *
 * ── arsId 를 nodeId 로 쓰는 이유 ──────────────────────────────
 * 서울 정류소에는 `stId`(내부 고유 ID)와 `arsId`(표지판에 적힌 5자리 번호)가
 * 둘 다 있습니다. 그런데 정류소로 조회하는 엔드포인트(getRouteByStation,
 * getStationByUid)가 전부 `arsId` 를 받습니다. `BusApi.getArrivals` 는
 * nodeId 하나만 넘겨받고, 즐겨찾기(Favorite)에도 nodeId 만 저장되므로
 * nodeId 자리에 arsId 를 넣어야 나중에 도착정보를 다시 조회할 수 있습니다.
 *
 * ── 필드 이름 검증 상태 ─────────────────────────────────────
 * 아래 Raw* 타입의 필드 이름은 공공데이터포털 문서 기준입니다. 인증키가 서울시
 * 서비스에 아직 반영되지 않아 실제 응답으로는 확인하지 못했습니다.
 * (2026-08-03 기준: 포털에는 승인, ws.bus.go.kr 은 인증모듈 에러코드 30)
 * 그래서 모든 선택 필드를 optional 로 두고, 이름이 다른 변형까지 함께 읽습니다.
 * 키가 열리면 `npm run verify:seoul` 로 실제 응답과 대조하세요.
 */

const STATION_SERVICE = '/stationinfo';

/** 정류소명 검색 (getStationByName) */
type RawStation = {
  stId?: string | number;
  stNm?: string;
  /** 표지판 번호. 가상 정류소는 "0" 이라 조회가 안 됩니다. */
  arsId?: string | number;
  /** WGS84 경도/위도. posX·posY 는 TM 좌표라 쓰지 않습니다. */
  tmX?: string | number;
  tmY?: string | number;
};

/** 정류소 경유노선 (getRouteByStation) */
type RawStationRoute = {
  busRouteId?: string | number;
  /** 노선명. 지선·간선은 번호("143"), 마을버스는 이름이 붙습니다. */
  busRouteNm?: string | number;
  /** 축약 노선명. 있으면 이쪽이 화면에 더 알맞습니다. */
  busRouteAbrv?: string | number;
  /** 노선유형 코드. 엔드포인트마다 이름이 달라 둘 다 읽습니다. */
  busRouteType?: string | number;
  routeType?: string | number;
};

/**
 * 정류소 도착정보 (getStationByUid).
 *
 * 노선 하나당 한 행이고, 그 안에 도착 예정 버스 두 대(1·2)가 들어 있습니다.
 * 앱은 가장 먼저 오는 차만 쓰므로 1번만 읽습니다.
 */
type RawStationArrival = {
  busRouteId?: string | number;
  rtNm?: string | number;
  busRouteAbrv?: string | number;
  routeType?: string | number;
  /** 도착까지 남은 초 */
  traTime1?: string | number;
  /** "3분54초후[2번째 전]", "곧 도착", "운행종료" 같은 사람이 읽는 문구 */
  arrmsg1?: string;
};

/**
 * 노선유형 코드 → 화면에 보여줄 이름.
 * TAGO 는 "간선버스" 처럼 문자열로 내려주는데 서울은 코드라서 여기서 맞춥니다.
 */
const ROUTE_TYPE_NAMES: Record<string, string> = {
  '1': '공항버스',
  '2': '마을버스',
  '3': '간선버스',
  '4': '지선버스',
  '5': '순환버스',
  '6': '광역버스',
  '7': '인천버스',
  '8': '경기버스',
  '9': '폐지',
  '0': '공용버스',
};

/** 도착 문구에서 남은 정류장 수를 꺼냅니다. "3분54초후[2번째 전]" → 2 */
const STOPS_LEFT_PATTERN = /\[(\d+)번째\s*전\]/;

/**
 * 아직 오지 않는 차의 도착 문구.
 *
 * TAGO 는 운행하지 않는 노선을 아예 안 내려주는데, 서울은 노선 목록을 그대로
 * 주면서 문구로만 알려줍니다. 그대로 두면 "곧 도착"(traTime 0) 으로 보여서
 * 알림이 잘못 울리므로 여기서 걸러냅니다.
 */
const NOT_RUNNING = ['운행종료', '출발대기', '차고지대기'];

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

function coord(value: string | number | undefined | null): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed !== 0 ? parsed : undefined;
}

function routeTypeName(
  ...candidates: Array<string | number | undefined>
): string | undefined {
  for (const candidate of candidates) {
    const code = text(candidate);
    if (code && ROUTE_TYPE_NAMES[code]) {
      return ROUTE_TYPE_NAMES[code];
    }
  }
  return undefined;
}

/** 가상 정류소(arsId 가 "0" 이거나 비어 있음)는 도착정보를 조회할 수 없습니다. */
function isQueryableStop(arsId: string | undefined): arsId is string {
  return !!arsId && arsId !== '0';
}

function toStop(raw: RawStation): BusStop | null {
  const arsId = text(raw.arsId);
  if (!isQueryableStop(arsId) || !raw.stNm) {
    return null;
  }
  return {
    // 위 "arsId 를 nodeId 로 쓰는 이유" 참고.
    nodeId: arsId,
    name: String(raw.stNm),
    number: arsId,
    cityCode: SEOUL_CITY_CODE,
    lat: coord(raw.tmY),
    lng: coord(raw.tmX),
  };
}

function toRoute(raw: RawStationRoute): BusRoute | null {
  const routeId = text(raw.busRouteId);
  const routeNo = text(raw.busRouteAbrv) ?? text(raw.busRouteNm);
  if (!routeId || !routeNo) {
    return null;
  }
  return {
    routeId,
    routeNo,
    routeType: routeTypeName(raw.busRouteType, raw.routeType),
  };
}

function toArrival(raw: RawStationArrival): Arrival | null {
  const routeId = text(raw.busRouteId);
  const routeNo = text(raw.rtNm) ?? text(raw.busRouteAbrv);
  const message = raw.arrmsg1;
  if (!routeId || !routeNo) {
    return null;
  }
  if (!message || NOT_RUNNING.some(word => message.includes(word))) {
    return null;
  }

  const stopsLeft = STOPS_LEFT_PATTERN.exec(message)?.[1];
  return {
    routeId,
    routeNo,
    secondsLeft: count(raw.traTime1),
    stopsLeft: stopsLeft === undefined ? undefined : Number(stopsLeft),
  };
}

async function fetchItems<T>(
  path: string,
  params: Record<string, unknown>,
): Promise<T[]> {
  const { data } = await seoulApi.get(path, { params });
  return unwrapSeoulItems<T>(data);
}

/**
 * 정류소 번호(arsId)로 정류소 한 곳을 찾습니다.
 *
 * 서울에는 번호로 정류소를 찾는 전용 엔드포인트가 없어서, 도착정보 조회를
 * 대신 씁니다. 응답이 노선별 한 행이라 정류소 정보는 첫 행에서만 꺼냅니다.
 * 그래서 그 시간에 오는 버스가 한 대도 없는 정류소는 번호로 찾을 수 없습니다.
 * (이름으로는 검색됩니다)
 */
async function findStopByArsId(arsId: string): Promise<BusStop[]> {
  const rows = await fetchItems<RawStation>(
    `${STATION_SERVICE}/getStationByUid`,
    { arsId },
  );
  const first = rows[0];
  if (!first) {
    return [];
  }
  // 응답에 arsId 가 빠져도 우리가 보낸 값이 그 정류소입니다.
  const stop = toStop({ ...first, arsId: text(first.arsId) ?? arsId });
  return stop ? [stop] : [];
}

export const seoulBusApi: BusApi = {
  async searchStops(keyword: string): Promise<BusStop[]> {
    const query = keyword.trim();
    if (!query) {
      return [];
    }

    // TAGO 쪽과 같은 규칙입니다. 숫자만 입력하면 정류소 번호로 봅니다.
    if (/^\d+$/.test(query)) {
      return findStopByArsId(query);
    }

    const rows = await fetchItems<RawStation>(
      `${STATION_SERVICE}/getStationByName`,
      { stSrch: query },
    );
    return rows.map(toStop).filter((stop): stop is BusStop => stop !== null);
  },

  async getRoutesAtStop(stop: BusStop): Promise<BusRoute[]> {
    const rows = await fetchItems<RawStationRoute>(
      `${STATION_SERVICE}/getRouteByStation`,
      { arsId: stop.nodeId },
    );
    return rows
      .map(toRoute)
      .filter((route): route is BusRoute => route !== null);
  },

  // cityCode 는 서울 고정이라 쓰지 않습니다. 파사드(BusApi) 시그니처를 맞춥니다.
  async getArrivals(_cityCode: CityCode, nodeId: string): Promise<Arrival[]> {
    const rows = await fetchItems<RawStationArrival>(
      `${STATION_SERVICE}/getStationByUid`,
      { arsId: nodeId },
    );
    return rows
      .map(toArrival)
      .filter((arrival): arrival is Arrival => arrival !== null)
      .sort((a, b) => a.secondsLeft - b.secondsLeft);
  },
};
