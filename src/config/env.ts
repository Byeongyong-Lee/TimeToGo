/**
 * 환경 설정.
 *
 * 실제 운영에서는 react-native-config 같은 라이브러리로 .env 를 분리하는 걸 권장합니다.
 * 지금은 의존성을 늘리지 않기 위해 __DEV__ 분기만 사용합니다.
 *
 * 안드로이드 에뮬레이터에서 PC의 localhost 는 10.0.2.2 입니다.
 * iOS 시뮬레이터는 localhost 를 그대로 사용합니다.
 */
import { Platform } from 'react-native';

const LOCAL_HOST = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';

export const env = {
  apiBaseUrl: __DEV__
    ? `http://${LOCAL_HOST}:8080/api`
    : 'https://api.example.com/api',
  /** 네트워크 요청 타임아웃 (ms) */
  timeout: 15_000,
} as const;
