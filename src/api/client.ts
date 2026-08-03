import axios, { type AxiosInstance } from 'axios';

import { SeoulBusError, toSeoulErrorMessage } from '@/api/seoulClient';
import { env } from '@/config/env';

/**
 * 공공데이터포털(TAGO) 호출용 axios 인스턴스.
 *
 * 로그인이 없는 앱이라 토큰 인터셉터나 401 재발급 로직은 없습니다.
 * 모든 요청에 인증키와 응답 포맷(json)만 공통으로 붙입니다.
 *
 * serviceKey 는 반드시 Decoding 키여야 합니다. params 에 넣으면 axios 가
 * 인코딩하므로, Encoding 키를 넣으면 이중 인코딩으로 인증에 실패합니다.
 */
export const api: AxiosInstance = axios.create({
  baseURL: env.tagoBaseUrl,
  timeout: env.timeout,
  params: {
    serviceKey: env.serviceKey,
    // 기본 응답은 XML 입니다. json 을 받으려면 매 요청에 붙여야 합니다.
    _type: 'json',
  },
});

/**
 * 공공데이터포털은 인증 실패나 쿼터 초과도 HTTP 200 + 에러 본문으로 내려줍니다.
 * 그래서 상태 코드만으로는 실패를 알 수 없어, 본문의 resultCode 를 확인해야 합니다.
 */
type TagoResponse<T> = {
  response?: {
    header?: { resultCode?: string; resultMsg?: string };
    body?: {
      items?: { item?: T | T[] } | '';
      totalCount?: number;
    };
  };
};

const RESULT_OK = '00';

export class TagoError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = 'TagoError';
  }
}

/**
 * TAGO 응답에서 항목 배열만 꺼냅니다.
 *
 * 이 API 는 결과가 없으면 items 를 빈 문자열로, 1건이면 배열이 아닌 객체로
 * 내려주기 때문에 그대로 map 을 돌리면 터집니다. 여기서 항상 배열로 맞춥니다.
 */
export function unwrapItems<T>(data: TagoResponse<T>): T[] {
  const header = data.response?.header;
  if (header?.resultCode && header.resultCode !== RESULT_OK) {
    throw new TagoError(
      header.resultCode,
      header.resultMsg ?? '공공데이터 요청에 실패했습니다.',
    );
  }

  const items = data.response?.body?.items;
  if (!items || typeof items === 'string') {
    return [];
  }

  const item = items.item;
  if (!item) {
    return [];
  }
  return Array.isArray(item) ? item : [item];
}

/**
 * 화면에 바로 보여줄 수 있는 에러 메시지로 정규화합니다.
 *
 * 화면(useAsync)은 어느 제공자에서 온 에러인지 모르므로, 여기서 서울시 쪽
 * 에러도 같이 받아 넘깁니다.
 */
export function toErrorMessage(error: unknown): string {
  if (error instanceof SeoulBusError) {
    return toSeoulErrorMessage(error);
  }
  if (error instanceof TagoError) {
    if (error.code === '30' || error.code === '31') {
      return '인증키가 올바르지 않거나 사용 기한이 지났습니다.';
    }
    if (error.code === '22') {
      return '오늘 요청 한도를 모두 사용했습니다.';
    }
    return error.message;
  }
  if (axios.isAxiosError(error)) {
    if (error.code === 'ECONNABORTED') {
      return '요청 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.';
    }
    if (!error.response) {
      return '네트워크에 연결할 수 없습니다.';
    }
    return `요청에 실패했습니다. (${error.response.status})`;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return '알 수 없는 오류가 발생했습니다.';
}
