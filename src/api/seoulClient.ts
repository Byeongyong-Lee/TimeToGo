import axios, { type AxiosInstance } from 'axios';

import { env } from '@/config/env';

/**
 * 서울시 버스 API(ws.bus.go.kr) 호출용 axios 인스턴스.
 *
 * 서울은 TAGO 에 포함되지 않아 별도 서버를 씁니다. 인증키는 공공데이터포털
 * 것을 그대로 쓰지만(같은 계정), 서비스별 활용신청은 따로 해야 합니다.
 *
 * ── http 인 이유 ──────────────────────────────────────────────
 * ws.bus.go.kr 은 HTTPS 를 지원하지 않습니다. 443 포트가 닫혀 있어 https 로는
 * 접속 자체가 실패합니다(타임아웃). 그래서 평문 http 로 호출하며, 안드로이드·
 * iOS 에 이 도메인만 평문 예외를 열어뒀습니다.
 *   - android/app/src/main/res/xml/network_security_config.xml
 *   - ios/TimeToGo/Info.plist 의 NSExceptionDomains
 *
 * 이 경로로는 인증키가 URL 에 평문으로 나갑니다. API 구조상 피할 수 없습니다.
 */
export const seoulApi: AxiosInstance = axios.create({
  baseURL: 'http://ws.bus.go.kr/api/rest',
  timeout: env.timeout,
  params: {
    serviceKey: env.serviceKey,
    // 기본 응답은 XML 입니다. json 을 받으려면 매 요청에 붙여야 합니다.
    resultType: 'json',
  },
});

/**
 * 서울 API 응답 봉투. TAGO(response.header/body)와 완전히 다릅니다.
 *
 * 실제 응답으로 확인한 모양:
 * {"comMsgHeader":{...},
 *  "msgHeader":{"headerMsg":"...","headerCd":"7","itemCount":0},
 *  "msgBody":{"itemList":null}}
 */
type SeoulResponse<T> = {
  msgHeader?: {
    headerCd?: string;
    headerMsg?: string;
    itemCount?: number;
  };
  msgBody?: {
    itemList?: T[] | T | null;
  } | null;
};

const HEADER_OK = '0';

export class SeoulBusError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = 'SeoulBusError';
  }
}

/**
 * 서울 API 응답에서 항목 배열만 꺼냅니다.
 *
 * TAGO 와 마찬가지로 인증 실패·한도 초과도 HTTP 200 으로 내려오므로 본문의
 * headerCd 를 봐야 합니다. 결과가 없으면 itemList 가 null 입니다.
 */
export function unwrapSeoulItems<T>(data: SeoulResponse<T>): T[] {
  const header = data.msgHeader;
  if (header?.headerCd && header.headerCd !== HEADER_OK) {
    throw new SeoulBusError(
      header.headerCd,
      header.headerMsg ?? '서울시 버스 정보 요청에 실패했습니다.',
    );
  }

  const itemList = data.msgBody?.itemList;
  if (!itemList) {
    return [];
  }
  return Array.isArray(itemList) ? itemList : [itemList];
}

/** 화면에 바로 보여줄 수 있는 에러 메시지로 정규화합니다. */
export function toSeoulErrorMessage(error: unknown): string {
  if (error instanceof SeoulBusError) {
    // 인증모듈 에러코드는 headerMsg 안에 문자열로 들어옵니다.
    if (error.message.includes('SERVICE KEY IS NOT REGISTERED')) {
      return '서울시 버스 서비스에 인증키가 등록되지 않았습니다. 공공데이터포털에서 활용신청을 확인해주세요.';
    }
    if (error.message.includes('LIMITED NUMBER OF SERVICE REQUESTS')) {
      return '오늘 서울시 버스 요청 한도를 모두 사용했습니다.';
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
