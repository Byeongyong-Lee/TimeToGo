# 나갈시간 (TimeToGo)

즐겨찾는 정류장의 버스가 몇 분 뒤 도착하는지 바로 보여주는 앱.

React Native 0.86.2 / React 19 / TypeScript 기반. React Native Community CLI 템플릿으로 생성했습니다.

| | 값 |
| --- | --- |
| 프로젝트명 | `TimeToGo` |
| 표시명 | 나갈시간 |
| Android `applicationId` | `com.timetogo` |
| iOS 번들 ID | `com.timetogo` |

## 처음 실행하기

```bash
npm install
```

### Android

```bash
npm run android
```

- Android Studio에서 SDK와 에뮬레이터가 설치되어 있어야 합니다.
- `ANDROID_HOME` 환경변수 설정이 필요합니다.
- 에뮬레이터에서 PC의 `localhost`는 `10.0.2.2`로 접근합니다. (`src/config/env.ts`에 반영돼 있습니다)

### iOS

macOS에서만 가능합니다.

```bash
bundle install
bundle exec pod install --project-directory=ios
npm run ios
```

### Metro만 따로 띄우기

```bash
npm start
```

## 스크립트

| 명령 | 설명 |
| --- | --- |
| `npm start` | Metro 번들러 실행 |
| `npm run android` | 안드로이드 빌드 & 실행 |
| `npm run ios` | iOS 빌드 & 실행 |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Jest |

## 폴더 구조

```
src/
├─ api/
│  ├─ client.ts      TAGO 호출용 axios 인스턴스 + 응답 언래핑 + 에러 메시지
│  ├─ busApi.ts      화면이 쓰는 파사드. mock ↔ TAGO 전환 지점
│  └─ mockBusApi.ts  화면 개발용 샘플 데이터 (정류장·노선·도착시간)
├─ components/     Screen, Button, TextField
├─ config/env.ts   useMockApi 플래그, TAGO 베이스 URL, 인증키, 타임아웃
├─ hooks/          useAsync (로딩·에러·refetch), useNow (1초 틱)
├─ navigation/     RootNavigator, 화면 파라미터 타입
├─ screens/        Favorites(홈), StopSearch(정류장 검색), StopRoutes(노선 선택),
│                  FavoriteAlarm(알림 세부 설정), Settings
├─ store/          zustand 스토어 (favoritesStore, persist v1)
├─ theme/          색상·간격·타이포그래피 토큰
└─ types/
   ├─ bus.ts       정류소·노선·도착·즐겨찾기 도메인 타입
   └─ alarm.ts     알림 설정 타입 + 활성 시간대 판정 (isAlarmActiveAt)
```

`@/` 를 `src/` 로 매핑해 뒀습니다. (`babel.config.js` + `tsconfig.json`)

```ts
import { api } from '@/api/client';
```

## 목데이터 모드

공공데이터포털 인증키가 없어도 앱 전체 플로우(검색 → 노선 등록 → 홈 도착시간)가 돌아가도록 `src/api/mockBusApi.ts` 에 샘플 데이터가 들어 있습니다. `src/config/env.ts` 의 `useMockApi` 가 `true` 면 목데이터를 씁니다.

실제 API 로 전환하려면:

1. `src/api/busApi.ts` 의 `tagoBusApi` 를 `api/client.ts` 의 `api` + `unwrapItems()` 로 구현
2. `env.serviceKey` 에 Decoding 키 입력
3. `env.useMockApi` 를 `false` 로 변경

화면 코드는 `busApi` 파사드만 바라보므로 전환 시 수정할 필요가 없습니다.

## 구조

로그인도 자체 서버도 없습니다. 공공데이터포털(TAGO) API 를 앱에서 직접 호출하고, 즐겨찾기만 기기에 저장합니다.

1. 사용자가 정류장·노선을 즐겨찾기에 등록 → `favoritesStore` 가 AsyncStorage 에 저장 (zustand `persist`)
2. 앱을 켜면 복원이 끝날 때까지 `App.tsx` 가 스플래시를 보여주고, 이후 `FavoritesScreen` 진입
3. `FavoritesScreen` 이 즐겨찾기 목록의 도착정보를 조회해서 남은 시간을 표시

### 알림 설정 (활성/비활성)

즐겨찾기마다 알림 설정(`Favorite.alarm`)이 있습니다. 홈에서 항목을 탭하면 설정 화면이 열립니다.

- **알림 사용** 토글 — 꺼도 목록에는 보이고 알림만 가지 않습니다
- **요일 + 활성 시간대** (예: 평일 07:00~07:20) — 이 조건에 들어왔을 때만 "활성"
- **알림 주기** — 30초 / 1분마다 도착정보를 확인해 푸시
- **알림 시작** — 남은 시간이 N분 이하로 내려오면 푸시 시작

활성 여부 판정은 `isAlarmActiveAt()` (`src/types/alarm.ts`, 테스트 있음). 설정은 저장되지만 실제 OS 푸시 발송 모듈(notifee 등)은 아직 연동 전입니다.

### 공공데이터포털 API 주의점

- 인증키는 **Decoding 키**를 `src/config/env.ts` 의 `serviceKey` 에 넣으세요. Encoding 키를 넣으면 axios 가 한 번 더 인코딩해서 인증에 실패합니다
- 문서에는 `http://` 로 안내돼 있지만 RN 은 평문 http 를 차단하므로 `https://` 로 호출합니다
- 인증 실패·쿼터 초과도 **HTTP 200 + 에러 본문**으로 옵니다. `unwrapItems()` 가 `resultCode` 를 확인해 `TagoError` 로 던집니다
- 결과가 없으면 `items` 가 빈 문자열, 1건이면 배열이 아닌 객체로 옵니다. `unwrapItems()` 가 항상 배열로 맞춰줍니다
- 개발계정은 일 10,000건 제한입니다

## 다음에 붙이면 좋은 것들

- **react-native-config** — 인증키를 `.env` 로 분리 (저장소에 키를 커밋하지 않기 위해)
- **@tanstack/react-query** — 도착정보 폴링·캐싱이 필요해지면. `useAsync` 와 인터페이스가 비슷해 교체가 쉽습니다
- **react-native-mmkv** — AsyncStorage 보다 빠른 저장소
- **위젯** — 이 앱의 핵심. RN 으로는 불가능하고 Android(Kotlin/Glance), iOS(Swift/WidgetKit) 로 따로 만들어야 합니다

## 주의

`android/`, `ios/` 네이티브 폴더가 포함돼 있습니다. 프로젝트명(`TimeToGo`)은 네이티브 프로젝트명·패키지 경로·번들 ID에 박혀 있어 바꾸려면 손이 많이 갑니다. 화면에 보이는 이름만 바꾸려면 `app.json`의 `displayName`과 `android/app/src/main/res/values/strings.xml`, `ios/TimeToGo/Info.plist`의 `CFBundleDisplayName`을 수정하세요.
