import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import Screen from '@/components/Screen';
import { env } from '@/config/env';
import { selectFavorites, useFavoritesStore } from '@/store/favoritesStore';
import { colors, spacing, typography } from '@/theme';

export default function SettingsScreen() {
  const favorites = useFavoritesStore(selectFavorites);

  return (
    <Screen>
      <View style={styles.section}>
        <Text style={styles.label}>등록된 노선</Text>
        <Text style={styles.value}>{favorites.length}개</Text>
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

const styles = StyleSheet.create({
  section: {
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
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
