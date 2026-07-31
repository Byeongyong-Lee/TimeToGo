/**
 * TimeToGo
 *
 * @format
 */

import React, { useEffect } from 'react';
import { ActivityIndicator, StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import RootNavigator from '@/navigation/RootNavigator';
import { connectAuthToApiClient, useAuthStore } from '@/store/authStore';
import { colors } from '@/theme';

// api 클라이언트 ↔ auth 스토어 연결 (모듈 로드 시 1회)
connectAuthToApiClient();

function App() {
  const hydrated = useAuthStore(state => state.hydrated);

  useEffect(() => {
    // persist 미들웨어가 복원을 마치면 hydrated 가 true 가 됩니다.
    // 스토리지 접근이 실패하는 등의 경우에도 앱이 멈추지 않도록 안전장치를 둡니다.
    const timer = setTimeout(() => {
      if (!useAuthStore.getState().hydrated) {
        useAuthStore.setState({ hydrated: true });
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      {hydrated ? (
        <RootNavigator />
      ) : (
        <View style={styles.splash}>
          <ActivityIndicator color={colors.primary} />
        </View>
      )}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
});

export default App;
