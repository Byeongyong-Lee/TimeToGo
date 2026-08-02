/**
 * TimeToGo (나갈시간)
 *
 * @format
 */

import React, { useEffect } from 'react';
import { ActivityIndicator, StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import RootNavigator from '@/navigation/RootNavigator';
import { useArrivalAlarms } from '@/notifications/useArrivalAlarms';
import { useFavoritesStore } from '@/store/favoritesStore';
import { colors } from '@/theme';

function App() {
  const hydrated = useFavoritesStore(state => state.hydrated);

  // 활성 시간대의 즐겨찾기를 폴링해서 도착 푸시를 띄웁니다 (앱이 떠 있는 동안).
  useArrivalAlarms();

  useEffect(() => {
    // persist 미들웨어가 복원을 마치면 hydrated 가 true 가 됩니다.
    // 스토리지 접근이 실패하는 등의 경우에도 앱이 멈추지 않도록 안전장치를 둡니다.
    const timer = setTimeout(() => {
      if (!useFavoritesStore.getState().hydrated) {
        useFavoritesStore.setState({ hydrated: true });
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
