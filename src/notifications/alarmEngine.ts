import { busApi } from '@/api/busApi';
import {
  ensureNotificationPermission,
  notifyArrival,
} from '@/notifications/notifier';
import { useFavoritesStore } from '@/store/favoritesStore';
import {
  alarmStartsWithin,
  isAlarmActiveAt,
  nextAlarmStart,
} from '@/types/alarm';
import { isSeoul, type Arrival, type CityCode, type Favorite } from '@/types/bus';

/**
 * 알림 판단 로직의 본체.
 *
 * React 훅(useArrivalAlarms)과 Android 포그라운드 서비스가 같은 로직을
 * 공유하도록 컴포넌트 밖으로 빼놨습니다. zustand 스토어는 React 밖에서도
 * getState() 로 읽을 수 있어서 헤드리스(서비스) 컨텍스트에서도 동작합니다.
 */

/** 기본 틱. 즐겨찾기별 알림 주기(30초/1분)는 이 위에서 개별 판정합니다. */
export const BASE_TICK_MS = 30_000;

/** 활성 시간대 시작 이 시간 전부터 서비스를 미리 띄워둡니다 (분) */
export const SERVICE_LEAD_MINUTES = 60;

/**
 * 서울시 정류장의 최소 재조회 간격.
 *
 * 서울시 버스 API 는 개발계정 일일 한도가 1,000건으로 TAGO(10,000건)의 1/10
 * 입니다. 매 틱(30초)마다 조회하면 활성 2시간 기준 정류장당 240건이라
 * 즐겨찾기 두어 개로 하루치가 소진됩니다.
 *
 * 그래서 서울만 2분에 한 번 조회하고, 그 사이 틱에서는 직전 응답의 남은 시간을
 * 경과분만큼 깎아서 씁니다. 정류장당 60건/2시간으로 줄어듭니다.
 *
 * 알림 주기(alarm.intervalSec)와는 별개입니다. 알림은 기존대로 사용자가 정한
 * 주기로 뜨고, 네트워크 조회 횟수만 줄어듭니다.
 */
export const SEOUL_MIN_FETCH_MS = 120_000;

/** 캐시를 이만큼 오래 안 쓰면 버립니다. (삭제된 즐겨찾기 정리용) */
const CACHE_TTL_MS = 600_000;

function minFetchIntervalMs(cityCode: CityCode): number {
  return isSeoul(cityCode) ? SEOUL_MIN_FETCH_MS : BASE_TICK_MS;
}

type CachedArrivals = {
  fetchedAt: number;
  arrivals: Arrival[];
};

/** 정류장별 마지막 도착정보. `${cityCode}:${nodeId}` 가 키입니다. */
const arrivalCache = new Map<string, CachedArrivals>();

/** 캐시를 비웁니다. 테스트에서 틱 사이 상태를 격리할 때 씁니다. */
export function clearArrivalCache(): void {
  arrivalCache.clear();
}

/**
 * 캐시를 지금 쓸 수 있는지.
 *
 * 시계가 뒤로 가면(NTP 보정, 사용자가 시각 변경) 경과분이 음수가 되어 남은
 * 시간이 부풀려집니다. 그 경우 캐시를 버리고 다시 조회합니다.
 */
function isCacheFresh(cached: CachedArrivals, now: number, cityCode: CityCode) {
  const elapsed = now - cached.fetchedAt;
  return elapsed >= 0 && elapsed < minFetchIntervalMs(cityCode);
}

/**
 * 캐시된 도착정보를 지금 시각 기준으로 환산합니다.
 *
 * 버스는 계속 다가오므로 남은 시간에서 경과분을 빼면 실제와 크게 어긋나지
 * 않습니다. 이미 지나간 차(0 이하)는 버립니다.
 */
function countdown(cached: CachedArrivals, now: number): Arrival[] {
  const elapsedSec = Math.max(0, Math.floor((now - cached.fetchedAt) / 1000));
  return cached.arrivals
    .map(arrival => ({
      ...arrival,
      secondsLeft: arrival.secondsLeft - elapsedSec,
    }))
    .filter(arrival => arrival.secondsLeft > 0);
}

function getFavorites(): Favorite[] {
  return useFavoritesStore.getState().favorites;
}

/** AsyncStorage 복원이 끝날 때까지 기다립니다. 서비스가 먼저 뜰 때 대비. */
export function waitForHydration(): Promise<void> {
  if (useFavoritesStore.getState().hydrated) {
    return Promise.resolve();
  }
  return new Promise(resolve => {
    const unsubscribe = useFavoritesStore.subscribe(state => {
      if (state.hydrated) {
        unsubscribe();
        resolve();
      }
    });
  });
}

/**
 * 포그라운드 서비스가 떠 있어야 하는 상황인지.
 * 활성 시간대이거나, 곧(SERVICE_LEAD_MINUTES 안에) 시작될 때 true 입니다.
 */
export function shouldServiceRun(date: Date = new Date()): boolean {
  return getFavorites().some(
    favorite =>
      isAlarmActiveAt(favorite.alarm, date) ||
      alarmStartsWithin(favorite.alarm, date, SERVICE_LEAD_MINUTES),
  );
}

/** 다음 활성 구간 시작 시각. AlarmManager 예약 기동용. */
export function nextServiceStart(from: Date = new Date()): Date | null {
  return nextAlarmStart(
    getFavorites().map(favorite => favorite.alarm),
    from,
  );
}

/**
 * 알림 틱 한 번.
 *
 * 활성이면서 알림 주기가 지난 즐겨찾기의 도착정보를 정류장 단위로 조회해,
 * 남은 시간이 "알림 시작(N분)" 이하인 노선에 푸시를 띄웁니다.
 * lastNotified 는 호출자가 들고 있는 즐겨찾기별 마지막 알림 시각입니다.
 */
export async function tickAlarms(
  lastNotified: Record<string, number>,
): Promise<void> {
  const now = Date.now();
  const date = new Date(now);
  const due = getFavorites().filter(
    favorite =>
      isAlarmActiveAt(favorite.alarm, date) &&
      now - (lastNotified[favorite.id] ?? 0) >=
        favorite.alarm.intervalSec * 1000,
  );
  if (due.length === 0) {
    return;
  }
  if (!(await ensureNotificationPermission())) {
    return;
  }

  // 오래된 캐시 정리 (삭제된 즐겨찾기의 항목이 남지 않도록)
  for (const [key, cached] of arrivalCache) {
    if (now - cached.fetchedAt > CACHE_TTL_MS) {
      arrivalCache.delete(key);
    }
  }

  // 같은 정류장은 한 번만 조회합니다.
  const stops = new Map<string, Favorite>();
  for (const favorite of due) {
    stops.set(`${favorite.cityCode}:${favorite.nodeId}`, favorite);
  }
  const arrivalsByStop = new Map<string, Arrival[]>();
  await Promise.all(
    [...stops.values()].map(async stop => {
      const key = `${stop.cityCode}:${stop.nodeId}`;
      const cached = arrivalCache.get(key);

      // 제공자별 최소 간격이 안 지났으면 직전 응답을 환산해서 씁니다.
      // 서울은 일일 한도가 낮아 이 간격이 깁니다. (SEOUL_MIN_FETCH_MS)
      if (cached && isCacheFresh(cached, now, stop.cityCode)) {
        arrivalsByStop.set(key, countdown(cached, now));
        return;
      }

      try {
        const arrivals = await busApi.getArrivals(stop.cityCode, stop.nodeId);
        arrivalCache.set(key, { fetchedAt: now, arrivals });
        arrivalsByStop.set(key, arrivals);
      } catch {
        // 조회 실패는 다음 틱에 다시 시도합니다.
        // 직전 응답이 있으면 그거라도 환산해서 씁니다.
        if (cached) {
          arrivalsByStop.set(key, countdown(cached, now));
        }
      }
    }),
  );

  for (const favorite of due) {
    const first = arrivalsByStop
      .get(`${favorite.cityCode}:${favorite.nodeId}`)
      ?.filter(arrival => arrival.routeId === favorite.routeId)
      .sort((a, b) => a.secondsLeft - b.secondsLeft)[0];
    if (first && first.secondsLeft <= favorite.alarm.notifyFromMinutes * 60) {
      lastNotified[favorite.id] = now;
      await notifyArrival(favorite, first);
    }
  }
}
