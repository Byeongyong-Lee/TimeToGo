import notifee, {
  AndroidImportance,
  AuthorizationStatus,
} from '@notifee/react-native';
import { Platform } from 'react-native';

import { formatSecondsLeft, type Arrival, type Favorite } from '@/types/bus';

/**
 * notifee 래퍼. 권한 요청·채널 생성·도착 알림 표시만 담당하고,
 * "언제 알릴지"는 useArrivalAlarms 훅이 결정합니다.
 */

const CHANNEL_ID = 'arrivals';

let permissionGranted: boolean | null = null;

/**
 * 알림 권한을 확인하고 없으면 요청합니다.
 * 이미 허용/거부된 상태면 시스템 팝업 없이 결과만 돌아옵니다.
 */
export async function ensureNotificationPermission(): Promise<boolean> {
  if (permissionGranted !== null) {
    return permissionGranted;
  }
  const settings = await notifee.requestPermission();
  permissionGranted =
    settings.authorizationStatus >= AuthorizationStatus.AUTHORIZED;
  return permissionGranted;
}

async function ensureChannel(): Promise<string> {
  if (Platform.OS === 'android') {
    // createChannel 은 이미 있으면 그대로 두는 멱등 호출입니다.
    await notifee.createChannel({
      id: CHANNEL_ID,
      name: '버스 도착 알림',
      importance: AndroidImportance.HIGH,
    });
  }
  return CHANNEL_ID;
}

/**
 * 도착 알림을 표시합니다.
 * 알림 id 를 즐겨찾기 id 로 고정해서, 같은 노선은 쌓이지 않고 갱신됩니다.
 */
export async function notifyArrival(
  favorite: Favorite,
  arrival: Arrival,
): Promise<void> {
  const channelId = await ensureChannel();
  await notifee.displayNotification({
    id: favorite.id,
    title: `${favorite.routeNo}번 버스 ${formatSecondsLeft(arrival.secondsLeft)}`,
    body:
      arrival.stopsLeft != null
        ? `${favorite.stopName} · ${arrival.stopsLeft}개 정류장 전`
        : favorite.stopName,
    android: {
      channelId,
      pressAction: { id: 'default' },
    },
  });
}

/** 즐겨찾기 삭제 등으로 더 이상 유효하지 않은 알림을 지웁니다. */
export async function cancelArrivalNotification(
  favoriteId: string,
): Promise<void> {
  await notifee.cancelNotification(favoriteId);
}
