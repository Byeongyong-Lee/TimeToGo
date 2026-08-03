/**
 * 환경 설정.
 *
 * 이 앱은 자체 서버가 없고 공공데이터포털(TAGO) API 를 직접 호출합니다.
 *
 * 인증키는 저장소에 올라가면 안 되므로 gitignore 된 `serviceKey.ts` 에 두고
 * 여기서 가져다 씁니다. "Cannot find module '@/config/serviceKey'" 오류가 나면
 * `serviceKey.example.ts` 를 `serviceKey.ts` 로 복사한 뒤 키를 채우세요.
 *
 * 인증키 주의사항:
 * - 공공데이터포털 마이페이지에는 Encoding 키와 Decoding 키가 따로 있습니다.
 *   axios 가 params 를 자동으로 URL 인코딩하므로 Encoding 키를 넣으면 이중
 *   인코딩되어 SERVICE_KEY_IS_NOT_REGISTERED 오류가 납니다. Decoding 키를 쓰세요.
 * - 문서에는 http 로 안내돼 있지만 RN 은 평문 http 를 차단하므로 https 로 호출합니다.
 */

import { SERVICE_KEY } from '@/config/serviceKey';

export const env = {
  /**
   * true 면 실제 API 대신 src/api/mockBusApi.ts 의 샘플 데이터를 사용합니다.
   * 네트워크 없이 화면만 만질 때 켜세요.
   */
  useMockApi: false as boolean,
  /** TAGO 오픈API 베이스. 서비스별 경로는 각 api 모듈에서 붙입니다. */
  tagoBaseUrl: 'https://apis.data.go.kr/1613000',
  /** 공공데이터포털 Decoding 인증키. 비어 있으면 API 호출이 실패합니다. */
  serviceKey: SERVICE_KEY,
  /**
   * 도시를 한 번도 고르지 않았을 때 쓸 기본 지역.
   *
   * TAGO 정류소 검색은 도시코드가 필수인데 `BusApi.searchStops` 는 키워드만
   * 받아서, 실제 검색에 쓰는 값은 `settingsStore` 에 저장된 도시입니다.
   * 이 값은 그 초기값일 뿐입니다. 목록은 `getCityCodes()` 로 조회합니다.
   */
  defaultCity: { code: 25, name: '대전광역시/계룡시' },
  /** 네트워크 요청 타임아웃 (ms) */
  timeout: 15_000,
} as const;
