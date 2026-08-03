/**
 * 버스 도메인 타입.
 *
 * 공공데이터포털(TAGO) 응답을 그대로 쓰지 않고, 앱에서 쓸 형태로 정규화한 모델입니다.
 * TAGO 원본 응답은 키가 전부 소문자(nodeid, routeno, arrtime ...)이고 지자체별로
 * 빠지는 필드가 있어서, API 를 붙일 때 매핑 레이어에서 이 타입으로 변환합니다.
 */

/** 지자체 도시코드. TAGO 의 도시코드 목록 조회로 얻습니다. */
export type CityCode = number;

/**
 * TAGO 가 지원하는 지자체.
 *
 * 주의: 이 목록에 서울(11)은 없습니다. 서울 버스는 TAGO 가 아니라
 * 서울시 별도 오픈API(TOPIS)를 써야 합니다.
 */
export type City = {
  code: CityCode;
  name: string;
};

/**
 * 서울특별시.
 *
 * TAGO 도시코드 목록에 서울은 없어서, 표준 행정구역 코드(11)를 그대로 씁니다.
 * 이 코드의 정류장은 TAGO 가 아니라 서울시 별도 API(ws.bus.go.kr)로 조회합니다.
 */
export const SEOUL_CITY_CODE: CityCode = 11;

/** 도시 목록(TAGO)에 서울이 없어서, 지역 선택에 직접 끼워넣는 항목입니다. */
export const SEOUL_CITY: City = { code: SEOUL_CITY_CODE, name: '서울특별시' };

export function isSeoul(cityCode: CityCode): boolean {
  return cityCode === SEOUL_CITY_CODE;
}

/** 정류소 */
export type BusStop = {
  /** 정류소 ID (TAGO: nodeid) */
  nodeId: string;
  /** 정류소명 (TAGO: nodenm) */
  name: string;
  /** 표지판에 적힌 정류소 번호 (TAGO: nodeno) */
  number?: string;
  cityCode: CityCode;
  lat?: number;
  lng?: number;
};

/** 노선 */
export type BusRoute = {
  /** 노선 ID (TAGO: routeid) */
  routeId: string;
  /** 노선 번호. 화면에 크게 보여줄 값 (TAGO: routeno) */
  routeNo: string;
  /** 노선 유형. 간선/지선/마을 등 (TAGO: routetp) */
  routeType?: string;
};

/** 특정 정류소에 특정 노선이 도착하기까지의 정보 */
export type Arrival = {
  routeId: string;
  routeNo: string;
  /** 도착까지 남은 초 (TAGO: arrtime) */
  secondsLeft: number;
  /** 남은 정류장 수 (TAGO: arrprevstationcnt) */
  stopsLeft?: number;
};

import type { FavoriteAlarm } from '@/types/alarm';

/**
 * 즐겨찾기 = "이 정류장에서 이 노선".
 * 앱의 핵심 단위. 홈 화면은 이 목록의 도착정보만 보여줍니다.
 */
export type Favorite = {
  /** `${cityCode}:${nodeId}:${routeId}` */
  id: string;
  cityCode: CityCode;
  nodeId: string;
  /** 정류소명 스냅샷. 매번 정류소를 다시 조회하지 않으려고 저장해둡니다. */
  stopName: string;
  routeId: string;
  routeNo: string;
  /** 요일·시간대·알림 주기 설정 */
  alarm: FavoriteAlarm;
  /** 정렬용. ISO 8601 */
  createdAt: string;
};

export function favoriteId(
  cityCode: CityCode,
  nodeId: string,
  routeId: string,
): string {
  return `${cityCode}:${nodeId}:${routeId}`;
}

/** 남은 초를 "3분 20초" / "곧 도착" 형태로 바꿉니다. */
export function formatSecondsLeft(secondsLeft: number): string {
  if (secondsLeft <= 30) {
    return '곧 도착';
  }
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  if (minutes === 0) {
    return `${seconds}초`;
  }
  return seconds === 0 ? `${minutes}분` : `${minutes}분 ${seconds}초`;
}
