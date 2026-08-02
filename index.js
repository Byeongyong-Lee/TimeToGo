/**
 * @format
 */

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import { registerArrivalForegroundService } from './src/notifications/foregroundService';

// 포그라운드 서비스 본체는 컴포넌트 밖(앱 시작 시)에서 등록해야
// 앱 UI 가 없는 헤드리스 상태에서도 동작합니다.
registerArrivalForegroundService();

AppRegistry.registerComponent(appName, () => App);
