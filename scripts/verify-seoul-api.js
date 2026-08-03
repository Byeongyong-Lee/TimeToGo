#!/usr/bin/env node
/**
 * 서울시 버스 API 응답 필드 검증기.
 *
 *   npm run verify:seoul
 *
 * 왜 필요한가:
 * src/api/seoulBusApi.ts 의 Raw* 타입은 공공데이터포털 문서를 보고 적은 것이고,
 * 인증키가 서울시 서비스에 반영되기 전이라 실제 응답으로 확인하지 못한 채
 * 커밋됐습니다. 이 스크립트는 실제 응답의 키를 뽑아 코드가 기대하는 필드와
 * 대조합니다.
 *
 * 읽는 법:
 *   OK      코드가 읽는 필드가 응답에 있음
 *   MISSING 코드가 읽는데 응답에 없음 → seoulBusApi.ts 를 고쳐야 함
 *   (그 외) 응답에는 있지만 코드가 안 쓰는 필드. 대부분 무시해도 됩니다.
 *
 * 실패해도 종료 코드는 1 입니다. CI 에 걸 수 있지만, 하루 1,000건 한도를
 * 쓰므로 자동 실행보다는 필요할 때 손으로 돌리는 용도입니다.
 */

const fs = require('fs');
const path = require('path');

const BASE = 'http://ws.bus.go.kr/api/rest';
const KEY_FILE = path.join(__dirname, '..', 'src', 'config', 'serviceKey.ts');

/**
 * 각 엔드포인트에서 seoulBusApi.ts 가 실제로 읽는 필드.
 * required 가 하나라도 빠지면 매핑이 깨집니다.
 * optional 은 없어도 동작하지만 화면에서 정보가 빠집니다.
 */
const CHECKS = [
  {
    name: 'getStationByName (정류소명 검색)',
    path: 'stationinfo/getStationByName',
    params: { stSrch: '강남역' },
    required: ['stNm', 'arsId'],
    optional: ['stId', 'tmX', 'tmY'],
  },
  {
    name: 'getRouteByStation (정류소 경유노선)',
    path: 'stationinfo/getRouteByStation',
    params: { arsId: '22007' },
    required: ['busRouteId'],
    // busRouteAbrv 가 없으면 busRouteNm 을 씁니다. 유형 코드는 이름이 두 가지.
    optional: ['busRouteNm', 'busRouteAbrv', 'busRouteType', 'routeType'],
  },
  {
    name: 'getStationByUid (정류소 도착정보)',
    path: 'stationinfo/getStationByUid',
    params: { arsId: '22007' },
    required: ['busRouteId', 'rtNm', 'arrmsg1', 'traTime1'],
    optional: ['stNm', 'arsId', 'busRouteAbrv', 'routeType'],
  },
];

function readServiceKey() {
  const source = fs.readFileSync(KEY_FILE, 'utf8');
  const match = source.match(/SERVICE_KEY\s*=\s*'([^']+)'/);
  if (!match || !match[1]) {
    throw new Error(
      `${KEY_FILE} 에서 SERVICE_KEY 를 찾지 못했습니다. serviceKey.example.ts 를 복사해 채웠는지 확인하세요.`,
    );
  }
  return match[1];
}

async function fetchItems(serviceKey, check) {
  const query = new URLSearchParams({
    serviceKey,
    resultType: 'json',
    ...check.params,
  });
  const response = await fetch(`${BASE}/${check.path}?${query}`);
  const body = await response.text();

  let data;
  try {
    data = JSON.parse(body);
  } catch {
    throw new Error(`JSON 이 아닌 응답: ${body.slice(0, 200)}`);
  }

  const header = data.msgHeader || {};
  // 인증 실패·한도 초과도 HTTP 200 이라 본문의 headerCd 를 봐야 합니다.
  if (header.headerCd && header.headerCd !== '0') {
    throw new Error(`headerCd ${header.headerCd}: ${header.headerMsg}`);
  }

  const itemList = (data.msgBody || {}).itemList;
  if (!itemList) {
    return [];
  }
  return Array.isArray(itemList) ? itemList : [itemList];
}

function report(check, items) {
  if (items.length === 0) {
    console.log('  결과 0건 — 필드를 확인할 수 없습니다.');
    console.log('  (심야 시간대에는 도착정보가 비어 있을 수 있습니다)');
    return true;
  }

  const item = items[0];
  const present = new Set(Object.keys(item));
  let ok = true;

  for (const field of check.required) {
    if (present.has(field)) {
      console.log(`  OK       ${field} = ${JSON.stringify(item[field])}`);
    } else {
      console.log(`  MISSING  ${field}  ← 필수. seoulBusApi.ts 를 고쳐야 합니다`);
      ok = false;
    }
  }
  for (const field of check.optional) {
    const mark = present.has(field) ? 'OK      ' : 'missing ';
    const value = present.has(field) ? ` = ${JSON.stringify(item[field])}` : '';
    console.log(`  ${mark} ${field}${value}`);
  }

  const unused = [...present].filter(
    field => !check.required.includes(field) && !check.optional.includes(field),
  );
  if (unused.length > 0) {
    console.log(`  안 쓰는 필드: ${unused.join(', ')}`);
  }
  return ok;
}

async function main() {
  const serviceKey = readServiceKey();
  console.log(`서울시 버스 API 검증 (${BASE})\n`);

  let allOk = true;
  for (const check of CHECKS) {
    console.log(`▶ ${check.name}`);
    try {
      const items = await fetchItems(serviceKey, check);
      console.log(`  ${items.length}건`);
      allOk = report(check, items) && allOk;
    } catch (error) {
      console.log(`  실패: ${error.message}`);
      if (String(error.message).includes('NOT REGISTERED')) {
        console.log(
          '  → 포털에는 승인이어도 ws.bus.go.kr 에 아직 반영되지 않았을 수 있습니다.',
        );
      }
      allOk = false;
    }
    console.log('');
  }

  console.log(allOk ? '모든 필드가 코드와 일치합니다.' : '확인이 필요합니다.');
  process.exitCode = allOk ? 0 : 1;
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
