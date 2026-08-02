import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';

import {
  BASE_TICK_MS,
  shouldServiceRun,
  tickAlarms,
} from '@/notifications/alarmEngine';
import {
  scheduleServiceStart,
  startArrivalService,
  stopArrivalService,
} from '@/notifications/foregroundService';
import {
  cancelArrivalNotification,
  ensureNotificationPermission,
} from '@/notifications/notifier';
import { selectFavorites, useFavoritesStore } from '@/store/favoritesStore';

/**
 * 즐겨찾기 알림 관리 훅. App.tsx 에서 한 번 마운트합니다.
 *
 * - Android: 실제 폴링·푸시는 포그라운드 서비스가 담당하고, 이 훅은
 *   "활성이거나 곧 시작될 즐겨찾기가 있는지"를 보고 서비스를 올리고 내리는
 *   역할만 합니다. 서비스 덕분에 앱이 백그라운드로 가도 알림이 옵니다.
 * - iOS: 포그라운드 서비스 개념이 없어서 앱이 떠 있는 동안만
 *   인앱 폴링(tickAlarms)으로 알림을 띄웁니다.
 */
export function useArrivalAlarms() {
  const favorites = useFavoritesStore(selectFavorites);

  /** 즐겨찾기별 마지막 알림 시각 (iOS 인앱 폴링용, epoch ms) */
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

  // 즐겨찾기·설정이 바뀌면 서비스 필요 여부를 바로 재평가합니다 (Android).
  useEffect(() => {
    if (Platform.OS !== 'android') {
      return;
    }
    manageService();
  }, [favorites]);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    let running = false;

    const tick = async () => {
      if (running) {
        return; // 이전 틱이 아직 안 끝났으면 건너뜁니다.
      }
      running = true;
      try {
        if (Platform.OS === 'android') {
          await manageService();
        } else {
          await tickAlarms(lastNotifiedRef.current);
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

    // 이 틱은 앱이 화면에 떠 있을 때만 돕니다. Android 는 백그라운드에서도
    // 포그라운드 서비스가 자체 틱으로 계속 돌고, 시간대가 끝나면 스스로 내려갑니다.
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

/**
 * 서비스가 필요하면 올리고, 필요 없으면 내린 뒤 다음 활성 시간대 시작에
 * AlarmManager 예약을 걸어둡니다. 예약 덕분에 앱을 완전히 꺼둬도
 * 다음 시간대에 서비스가 스스로 깨어납니다.
 */
async function manageService(): Promise<void> {
  // 상시 알림·예약 알림 모두 알림 권한이 필요합니다.
  if (!(await ensureNotificationPermission())) {
    return;
  }
  if (shouldServiceRun()) {
    await startArrivalService();
  } else {
    await stopArrivalService();
    await scheduleServiceStart();
  }
}
