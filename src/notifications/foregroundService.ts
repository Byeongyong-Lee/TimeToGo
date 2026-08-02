import notifee, { AndroidImportance } from '@notifee/react-native';
import { Platform } from 'react-native';

import {
  BASE_TICK_MS,
  shouldServiceRun,
  tickAlarms,
  waitForHydration,
} from '@/notifications/alarmEngine';

/**
 * Android 포그라운드 서비스.
 *
 * 앱이 백그라운드로 가도 활성 시간대 동안 도착정보 폴링이 계속 돌도록,
 * 상단에 상시 알림("버스 도착 확인 중")을 띄운 서비스 안에서 틱을 돌립니다.
 *
 * - 서비스 시작/중지는 useArrivalAlarms 가 결정합니다 (활성이거나 곧 시작이면 시작)
 * - 활성 시간대가 끝나면 서비스가 스스로 내려갑니다
 * - 앱 프로세스가 완전히 죽은 상태에서 되살아나는 예약 실행은 지원하지 않습니다
 *   (활성 시간대 근처에 앱을 한 번 열어두면 됩니다)
 */

const SERVICE_NOTIFICATION_ID = 'arrival-service';
const SERVICE_CHANNEL_ID = 'arrival-service';

let serviceInterval: ReturnType<typeof setInterval> | null = null;
let serviceRunning = false;

/**
 * 서비스 본체 등록. index.js 에서 앱 시작 시 한 번 호출해야 합니다.
 * (컴포넌트 라이프사이클 밖에서 등록해야 헤드리스 상태에서도 돕니다)
 */
export function registerArrivalForegroundService(): void {
  if (Platform.OS !== 'android') {
    return;
  }
  notifee.registerForegroundService(() => {
    // 이 프라미스가 살아 있는 동안 서비스가 유지됩니다.
    // 종료는 stopArrivalService() 가 담당합니다.
    return new Promise(() => {
      const lastNotified: Record<string, number> = {};
      const loop = async () => {
        await waitForHydration();
        if (!shouldServiceRun()) {
          await stopArrivalService();
          return;
        }
        await tickAlarms(lastNotified);
      };
      loop();
      serviceInterval = setInterval(loop, BASE_TICK_MS);
    });
  });
}

/** 상시 알림을 띄우면서 서비스를 시작합니다. 이미 떠 있으면 아무것도 안 합니다. */
export async function startArrivalService(): Promise<void> {
  if (Platform.OS !== 'android' || serviceRunning) {
    return;
  }
  serviceRunning = true;
  try {
    await notifee.createChannel({
      id: SERVICE_CHANNEL_ID,
      name: '도착 확인 서비스',
      // 상시 알림이라 소리·진동 없이 조용히 둡니다.
      importance: AndroidImportance.LOW,
    });
    await notifee.displayNotification({
      id: SERVICE_NOTIFICATION_ID,
      title: '버스 도착 확인 중',
      body: '활성 시간대의 노선 도착정보를 확인하고 있습니다.',
      android: {
        channelId: SERVICE_CHANNEL_ID,
        asForegroundService: true,
        ongoing: true,
        pressAction: { id: 'default' },
      },
    });
  } catch (error) {
    serviceRunning = false;
    throw error;
  }
}

/** 서비스와 상시 알림을 내립니다. 안 떠 있으면 아무것도 안 합니다. */
export async function stopArrivalService(): Promise<void> {
  if (Platform.OS !== 'android' || !serviceRunning) {
    return;
  }
  serviceRunning = false;
  if (serviceInterval) {
    clearInterval(serviceInterval);
    serviceInterval = null;
  }
  try {
    await notifee.stopForegroundService();
  } catch {
    // 이미 내려간 경우는 무시합니다.
  }
}
