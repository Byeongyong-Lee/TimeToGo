# MoEum

React Native 0.86.2 / React 19 / TypeScript 기반 앱. React Native Community CLI 템플릿으로 생성했습니다.

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
├─ api/           서버 통신
│  ├─ client.ts   axios 인스턴스 + 토큰 인터셉터 + 401 자동 refresh
│  ├─ auth.ts     로그인 / 내 정보 / 로그아웃
│  └─ items.ts    리소스 예시 (실제 엔드포인트로 교체하세요)
├─ components/    Screen, Button, TextField
├─ config/env.ts  API 주소, 타임아웃
├─ hooks/         useAsync (로딩·에러·refetch)
├─ navigation/    RootNavigator, 화면 파라미터 타입
├─ screens/       Login, Home, Items, ItemDetail, Settings
├─ store/         zustand 스토어 (authStore)
├─ theme/         색상·간격·타이포그래피 토큰
└─ types/         서버 응답 타입
```

`@/` 를 `src/` 로 매핑해 뒀습니다. (`babel.config.js` + `tsconfig.json`)

```ts
import { api } from '@/api/client';
```

## 인증 흐름

1. `LoginScreen`에서 `authStore.login()` 호출 → `POST /auth/login`
2. accessToken / refreshToken / user를 AsyncStorage에 저장 (zustand `persist`)
3. `RootNavigator`가 토큰 유무로 로그인 화면 ↔ 메인 탭을 전환
4. API가 401을 주면 `client.ts`가 `POST /auth/refresh`를 1회 시도하고, 실패하면 세션을 비웁니다

서버 응답 형태가 다르면 `src/types/api.ts`와 `src/api/*.ts`만 고치면 됩니다.

## 다음에 붙이면 좋은 것들

- **@tanstack/react-query** — 캐싱·재검증이 필요해지면. `useAsync`와 인터페이스가 비슷해 교체가 쉽습니다.
- **react-native-config** — API 주소를 `.env`로 분리
- **react-native-mmkv** — AsyncStorage보다 빠른 저장소
- **react-native-vector-icons** — 탭 아이콘

## 주의

`android/`, `ios/` 네이티브 폴더가 포함돼 있습니다. 앱 이름(`MoEum`)은 네이티브 프로젝트명과 번들 ID에 박혀 있어 나중에 바꾸려면 손이 많이 갑니다. 화면에 보이는 이름만 바꾸려면 `app.json`의 `displayName`을 수정하세요.
