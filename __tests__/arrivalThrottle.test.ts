/**
 * @format
 *
 * 정류장 도착정보 조회 스로틀 테스트.
 *
 * 서울시 API 는 일일 한도가 낮아서(1,000건) 매 틱마다 조회하지 않고 캐시를
 * 로컬 카운트다운해서 씁니다. 이 동작이 알림 판정을 망가뜨리지 않는지 봅니다.
 */

import { busApi } from '@/api/busApi';
import {
  clearArrivalCache,
  SEOUL_MIN_FETCH_MS,
  tickAlarms,
} from '@/notifications/alarmEngine';
import { notifyArrival } from '@/notifications/notifier';
import { useFavoritesStore } from '@/store/favoritesStore';
import { DEFAULT_ALARM } from '@/types/alarm';
import { SEOUL_CITY_CODE, type Arrival, type Favorite } from '@/types/bus';

jest.mock('@/api/busApi', () => ({
  busApi: { getArrivals: jest.fn() },
}));

jest.mock('@/notifications/notifier', () => ({
  ensureNotificationPermission: jest.fn(() => Promise.resolve(true)),
  notifyArrival: jest.fn(() => Promise.resolve()),
  cancelArrivalNotification: jest.fn(() => Promise.resolve()),
}));

const getArrivals = busApi.getArrivals as jest.Mock;
const notify = notifyArrival as jest.Mock;

/** 월요일 07:10 고정 */
const BASE_TIME = new Date(2026, 0, 5, 7, 10).getTime();

const favorite = (cityCode: number): Favorite => ({
  id: `${cityCode}:STOP:ROUTE`,
  cityCode,
  nodeId: 'STOP',
  stopName: '테스트정류장',
  routeId: 'ROUTE',
  routeNo: '100',
  alarm: {
    ...DEFAULT_ALARM,
    days: [1],
    startMinutes: 7 * 60,
    endMinutes: 8 * 60,
    intervalSec: 30,
    notifyFromMinutes: 10,
  },
  createdAt: '2026-01-01T00:00:00.000Z',
});

const arrival = (secondsLeft: number): Arrival[] => [
  { routeId: 'ROUTE', routeNo: '100', secondsLeft },
];

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  jest.setSystemTime(BASE_TIME);
  // 캐시는 모듈 레벨이라 테스트끼리 새지 않게 비웁니다.
  clearArrivalCache();
  useFavoritesStore.setState({ favorites: [], hydrated: true });
});

afterEach(() => {
  jest.useRealTimers();
});

describe('서울 정류장 조회 스로틀', () => {
  test('최소 간격 안에서는 다시 조회하지 않는다', async () => {
    useFavoritesStore.setState({ favorites: [favorite(SEOUL_CITY_CODE)] });
    getArrivals.mockResolvedValue(arrival(600));

    const lastNotified: Record<string, number> = {};
    await tickAlarms(lastNotified);
    expect(getArrivals).toHaveBeenCalledTimes(1);

    // 30초 뒤 틱 — 서울은 최소 간격(2분)이 안 지나 조회하지 않습니다.
    jest.setSystemTime(BASE_TIME + 30_000);
    await tickAlarms(lastNotified);
    expect(getArrivals).toHaveBeenCalledTimes(1);

    // 최소 간격이 지나면 다시 조회합니다.
    jest.setSystemTime(BASE_TIME + SEOUL_MIN_FETCH_MS + 1_000);
    await tickAlarms(lastNotified);
    expect(getArrivals).toHaveBeenCalledTimes(2);
  });

  test('캐시를 쓰는 틱에서도 경과분만큼 남은 시간이 줄어든다', async () => {
    useFavoritesStore.setState({ favorites: [favorite(SEOUL_CITY_CODE)] });
    // 첫 조회에서 630초 남음 → 알림 기준(10분=600초)을 넘어 알림 없음
    getArrivals.mockResolvedValue(arrival(630));

    const lastNotified: Record<string, number> = {};
    await tickAlarms(lastNotified);
    expect(notify).not.toHaveBeenCalled();

    // 60초 뒤: 조회는 안 하지만 570초로 환산돼 알림 기준 안으로 들어옵니다.
    jest.setSystemTime(BASE_TIME + 60_000);
    await tickAlarms(lastNotified);
    expect(getArrivals).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify.mock.calls[0][1].secondsLeft).toBe(570);
  });

  test('이미 지나간 차는 캐시에서 제외된다', async () => {
    useFavoritesStore.setState({ favorites: [favorite(SEOUL_CITY_CODE)] });
    getArrivals.mockResolvedValue(arrival(40));

    const lastNotified: Record<string, number> = {};
    await tickAlarms(lastNotified);
    expect(notify).toHaveBeenCalledTimes(1);

    // 60초 뒤면 40초짜리 차는 이미 지나갔으므로 알림 대상이 없습니다.
    jest.setSystemTime(BASE_TIME + 60_000);
    await tickAlarms(lastNotified);
    expect(notify).toHaveBeenCalledTimes(1);
  });
});

describe('TAGO 정류장', () => {
  test('매 틱마다 조회한다', async () => {
    useFavoritesStore.setState({ favorites: [favorite(25)] });
    getArrivals.mockResolvedValue(arrival(600));

    const lastNotified: Record<string, number> = {};
    await tickAlarms(lastNotified);
    jest.setSystemTime(BASE_TIME + 30_000);
    await tickAlarms(lastNotified);

    expect(getArrivals).toHaveBeenCalledTimes(2);
  });
});
