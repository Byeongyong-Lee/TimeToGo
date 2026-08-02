import notifee, { AndroidNotificationSetting } from '@notifee/react-native';
import React, { useCallback, useEffect, useState } from 'react';
import {
  AppState,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import Screen from '@/components/Screen';
import { env } from '@/config/env';
import { selectFavorites, useFavoritesStore } from '@/store/favoritesStore';
import { colors, spacing, typography } from '@/theme';

export default function SettingsScreen() {
  const favorites = useFavoritesStore(selectFavorites);
  const exactAlarm = useExactAlarmSetting();

  return (
    <Screen>
      <View style={styles.section}>
        <Text style={styles.label}>등록된 노선</Text>
        <Text style={styles.value}>{favorites.length}개</Text>
      </View>

      {Platform.OS === 'android' && exactAlarm !== null ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => notifee.openAlarmPermissionSettings()}
          style={({ pressed }) => [styles.section, pressed && styles.pressed]}
        >
          <Text style={styles.label}>정확한 알람 (예약 기동)</Text>
          <Text style={styles.value}>
            {exactAlarm
              ? '허용됨 — 활성 시간대 시작에 제시간에 깨어납니다'
              : '허용 안 됨 — 눌러서 설정에서 허용하면 알림이 제시간에 옵니다'}
          </Text>
        </Pressable>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.label}>데이터 모드</Text>
        <Text style={styles.value}>
          {env.useMockApi
            ? '샘플 데이터 (공공데이터포털 연동 전)'
            : '실시간 (TAGO)'}
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>인증키</Text>
        <Text style={styles.value}>
          {env.serviceKey ? '설정됨' : '설정되지 않음'}
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>데이터 출처</Text>
        <Text style={styles.value}>
          국토교통부 국가대중교통정보센터(TAGO)
        </Text>
      </View>
    </Screen>
  );
}

/**
 * SCHEDULE_EXACT_ALARM 허용 여부 (Android 12+ 특수 권한).
 * 설정 앱에 다녀오면 값이 바뀌므로 앱이 다시 활성화될 때 재조회합니다.
 */
function useExactAlarmSetting(): boolean | null {
  const [enabled, setEnabled] = useState<boolean | null>(null);

  const refresh = useCallback(() => {
    if (Platform.OS !== 'android') {
      return;
    }
    notifee
      .getNotificationSettings()
      .then(settings =>
        setEnabled(
          settings.android?.alarm === AndroidNotificationSetting.ENABLED,
        ),
      )
      .catch(() => setEnabled(null));
  }, []);

  useEffect(() => {
    refresh();
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') {
        refresh();
      }
    });
    return () => subscription.remove();
  }, [refresh]);

  return enabled;
}

const styles = StyleSheet.create({
  section: {
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  pressed: {
    opacity: 0.7,
  },
  label: {
    ...typography.caption,
    color: colors.textMuted,
  },
  value: {
    ...typography.body,
    color: colors.text,
    marginTop: spacing.xs,
  },
});
