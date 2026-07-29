import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import Button from '@/components/Button';
import Screen from '@/components/Screen';
import { env } from '@/config/env';
import { useAuthStore } from '@/store/authStore';
import { colors, spacing, typography } from '@/theme';

export default function SettingsScreen() {
  const user = useAuthStore(state => state.user);
  const logout = useAuthStore(state => state.logout);

  return (
    <Screen>
      <View style={styles.section}>
        <Text style={styles.label}>계정</Text>
        <Text style={styles.value}>{user?.email ?? '-'}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>API 서버</Text>
        <Text style={styles.value}>{env.apiBaseUrl}</Text>
      </View>

      <Button
        label="로그아웃"
        variant="secondary"
        onPress={() => {
          logout();
        }}
        style={styles.logout}
      />
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
  logout: {
    marginTop: spacing.lg,
  },
});
