/**
 * 환경 설정.
 *
 * 이 앱은 자체 서버가 없고 공공데이터포털(TAGO) API 를 직접 호출합니다.
 *
 * 인증키 주의사항:
 * - 공공데이터포털 마이페이지에는 Encoding 키와 Decoding 키가 따로 있습니다.
 *   axios 가 params 를 자동으로 URL 인코딩하므로 Encoding 키를 넣으면 이중
 *   인코딩되어 SERVICE_KEY_IS_NOT_REGISTERED 오류가 납니다. Decoding 키를 쓰세요.
 * - 문서에는 http 로 안내돼 있지만 RN 은 평문 http 를 차단하므로 https 로 호출합니다.
 * - 키를 저장소에 커밋하지 마세요. 실제 값은 react-native-config 로 .env 에
 *   분리하고 .env 를 .gitignore 에 넣는 걸 권장합니다.
 */

export const env = {
  /** TAGO 오픈API 베이스. 서비스별 경로는 각 api 모듈에서 붙입니다. */
  tagoBaseUrl: 'https://apis.data.go.kr/1613000',
  /** 공공데이터포털 Decoding 인증키. 비어 있으면 API 호출이 실패합니다. */
  serviceKey: '',
  /** 네트워크 요청 타임아웃 (ms) */
  timeout: 15_000,
} as const;
