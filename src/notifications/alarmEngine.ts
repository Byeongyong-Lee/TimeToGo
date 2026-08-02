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
import type { Arrival, Favorite } from '@/types/bus';

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

  // 같은 정류장은 한 번만 조회합니다.
  const stops = new Map<string, Favorite>();
  for (const favorite of due) {
    stops.set(`${favorite.cityCode}:${favorite.nodeId}`, favorite);
  }
  const arrivalsByStop = new Map<string, Arrival[]>();
  await Promise.all(
    [...stops.values()].map(async stop => {
      try {
        arrivalsByStop.set(
          `${stop.cityCode}:${stop.nodeId}`,
          await busApi.getArrivals(stop.cityCode, stop.nodeId),
        );
      } catch {
        // 조회 실패는 다음 틱에 다시 시도합니다.
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
