import notifee, {
  AndroidImportance,
  AndroidNotificationSetting,
  TriggerType,
} from '@notifee/react-native';
import { Platform } from 'react-native';

import {
  BASE_TICK_MS,
  nextServiceStart,
  shouldServiceRun,
  tickAlarms,
  waitForHydration,
} from '@/notifications/alarmEngine';

/**
 * Android 포그라운드 서비스 + AlarmManager 예약 기동.
 *
 * 앱이 백그라운드로 가도 활성 시간대 동안 도착정보 폴링이 계속 돌도록,
 * 상단에 상시 알림("버스 도착 확인 중")을 띄운 서비스 안에서 틱을 돌립니다.
 *
 * - 서비스 시작/중지는 useArrivalAlarms 가 결정합니다 (활성이거나 곧 시작이면 시작)
 * - 활성 시간대가 끝나면 서비스가 스스로 내려가고, 다음 시작 시각에
 *   트리거 알림(notifee → AlarmManager)을 예약합니다. 그래서 앱 프로세스가
 *   죽어 있어도 다음 활성 시간대에 서비스가 스스로 깨어납니다
 * - 예약은 notifee 가 저장해 두므로 재부팅 후에도 유지됩니다
 * - "정확한 알람" 권한(SCHEDULE_EXACT_ALARM)이 없으면 예약이 수 분 늦게
 *   울릴 수 있습니다. 설정 화면에서 허용 여부를 보여줍니다
 */

const SERVICE_NOTIFICATION_ID = 'arrival-service';
const SERVICE_CHANNEL_ID = 'arrival-service';

let serviceInterval: ReturnType<typeof setInterval> | null = null;
let serviceRunning = false;
/** 마지막으로 예약한 기동 시각 (epoch ms). 같은 시각 중복 예약을 막습니다. */
let scheduledTimestamp: number | null = null;

async function ensureServiceChannel(): Promise<string> {
  await notifee.createChannel({
    id: SERVICE_CHANNEL_ID,
    name: '도착 확인 서비스',
    // 상시 알림이라 소리·진동 없이 조용히 둡니다.
    importance: AndroidImportance.LOW,
  });
  return SERVICE_CHANNEL_ID;
}

function serviceNotification(channelId: string) {
  return {
    id: SERVICE_NOTIFICATION_ID,
    title: '버스 도착 확인 중',
    body: '활성 시간대의 노선 도착정보를 확인하고 있습니다.',
    android: {
      channelId,
      asForegroundService: true,
      ongoing: true,
      pressAction: { id: 'default' as const },
    },
  };
}

/**
 * 서비스 본체 등록. index.js 에서 앱 시작 시 한 번 호출해야 합니다.
 * 트리거로 깨어난 헤드리스 상태에서도 index.js 가 실행되며 이 러너가 돕니다.
 */
export function registerArrivalForegroundService(): void {
  if (Platform.OS !== 'android') {
    return;
  }
  notifee.registerForegroundService(() => {
    // 이 프라미스가 살아 있는 동안 서비스가 유지됩니다.
    // 종료는 stopArrivalService() 가 담당합니다.
    return new Promise(() => {
      serviceRunning = true;
      scheduledTimestamp = null; // 트리거로 깨어났다면 그 예약은 소진됐습니다.
      const lastNotified: Record<string, number> = {};
      const loop = async () => {
        await waitForHydration();
        if (!shouldServiceRun()) {
          await stopArrivalService();
          await scheduleServiceStart();
          return;
        }
        await tickAlarms(lastNotified);
      };
      loop();
      serviceInterval = setInterval(loop, BASE_TICK_MS);
    });
  });
}

/** 상시 알림을 띄우면서 서비스를 지금 시작합니다. 이미 떠 있으면 아무것도 안 합니다. */
export async function startArrivalService(): Promise<void> {
  if (Platform.OS !== 'android' || serviceRunning) {
    return;
  }
  serviceRunning = true;
  try {
    // 지금 바로 띄우므로 대기 중인 예약 기동은 치웁니다.
    scheduledTimestamp = null;
    await notifee.cancelTriggerNotification(SERVICE_NOTIFICATION_ID);
    const channelId = await ensureServiceChannel();
    await notifee.displayNotification(serviceNotification(channelId));
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

/**
 * 다음 활성 구간 시작 시각에 서비스가 스스로 뜨도록 예약합니다.
 *
 * notifee 트리거 알림을 asForegroundService 로 걸어두면, 그 시각에
 * AlarmManager 가 앱 프로세스를 (죽어 있어도) 깨워 서비스를 시작합니다.
 * 같은 시각이 이미 예약돼 있으면 아무것도 하지 않습니다.
 */
export async function scheduleServiceStart(): Promise<void> {
  if (Platform.OS !== 'android' || serviceRunning) {
    return;
  }
  const startAt = nextServiceStart();
  if (!startAt) {
    if (scheduledTimestamp !== null) {
      scheduledTimestamp = null;
      await notifee.cancelTriggerNotification(SERVICE_NOTIFICATION_ID);
    }
    return;
  }
  const timestamp = startAt.getTime();
  if (timestamp === scheduledTimestamp) {
    return;
  }
  const channelId = await ensureServiceChannel();
  const settings = await notifee.getNotificationSettings();
  const exact =
    settings.android?.alarm === AndroidNotificationSetting.ENABLED;
  // 같은 id 로 다시 걸면 기존 예약이 교체됩니다.
  await notifee.createTriggerNotification(serviceNotification(channelId), {
    type: TriggerType.TIMESTAMP,
    timestamp,
    // 정확한 알람 권한이 있으면 도즈 모드에서도 제시간에 깨웁니다.
    // 없으면 WorkManager 예약이라 수 분 늦을 수 있습니다.
    ...(exact ? { alarmManager: { allowWhileIdle: true } } : {}),
  });
  scheduledTimestamp = timestamp;
}
