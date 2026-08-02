import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { busApi } from '@/api/busApi';
import {
  cancelArrivalNotification,
  ensureNotificationPermission,
  notifyArrival,
} from '@/notifications/notifier';
import { selectFavorites, useFavoritesStore } from '@/store/favoritesStore';
import { isAlarmActiveAt } from '@/types/alarm';
import type { Arrival, Favorite } from '@/types/bus';

/**
 * 즐겨찾기 알림 스케줄러.
 *
 * 30초 간격의 기본 틱마다:
 * 1. 지금 활성(요일·시간대 일치)이면서, 각자의 알림 주기(30초/1분)가
 *    지난 즐겨찾기를 고른다
 * 2. 해당 정류장들의 도착정보를 조회한다
 * 3. 남은 시간이 "알림 시작(N분)" 이하로 내려온 노선에 푸시를 띄운다
 *
 * OS 가 백그라운드에서 JS 타이머를 멈추기 때문에 이 폴링은 앱이 떠 있는
 * 동안만 돕니다. 화면이 꺼진 상태의 알림은 Android 포그라운드 서비스나
 * 서버 푸시가 필요해서 다음 단계로 미뤄뒀습니다.
 */

const BASE_TICK_MS = 30_000;

export function useArrivalAlarms() {
  const favorites = useFavoritesStore(selectFavorites);

  // 틱 콜백이 항상 최신 목록을 보도록 ref 로 넘깁니다.
  const favoritesRef = useRef(favorites);
  favoritesRef.current = favorites;

  /** 즐겨찾기별 마지막 알림 시각 (epoch ms) */
  const lastNotifiedRef = useRef<Record<string, number>>({});

  // 삭제된 즐겨찾기의 떠 있는 알림을 치웁니다.
  const prevIdsRef = useRef<string[]>([]);
  useEffect(() => {
    const ids = favorites.map(favorite => favorite.id);
    for (const id of prevIdsRef.current) {
      if (!ids.includes(id)) {
        delete lastNotifiedRef.current[id];
        cancelArrivalNotification(id).catch(() => {});
      }
    }
    prevIdsRef.current = ids;
  }, [favorites]);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    let running = false;

    const tick = async () => {
      if (running) {
        return; // 이전 틱의 조회가 아직 안 끝났으면 건너뜁니다.
      }
      running = true;
      try {
        const now = Date.now();
        const date = new Date(now);
        const due = favoritesRef.current.filter(
          favorite =>
            isAlarmActiveAt(favorite.alarm, date) &&
            now - (lastNotifiedRef.current[favorite.id] ?? 0) >=
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
          if (
            first &&
            first.secondsLeft <= favorite.alarm.notifyFromMinutes * 60
          ) {
            lastNotifiedRef.current[favorite.id] = now;
            await notifyArrival(favorite, first);
          }
        }
      } finally {
        running = false;
      }
    };

    const start = () => {
      if (!timer) {
        tick();
        timer = setInterval(tick, BASE_TICK_MS);
      }
    };
    const stop = () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    };

    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') {
        start();
      } else {
        stop();
      }
    });
    if (AppState.currentState === 'active') {
      start();
    }

    return () => {
      subscription.remove();
      stop();
    };
  }, []);
}
