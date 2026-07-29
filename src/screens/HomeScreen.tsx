import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import Screen from '@/components/Screen';
import { useAuthStore } from '@/store/authStore';
import { colors, radius, spacing, typography } from '@/theme';

export default function HomeScreen() {
  const user = useAuthStore(state => state.user);

  return (
    <Screen>
      <View style={styles.card}>
        <Text style={styles.title}>
          안녕하세요, {user?.nickname ?? '사용자'}님
        </Text>
        <Text style={styles.body}>
          여기부터 앱을 만들어 나가면 됩니다. src/screens 에 화면을 추가하고
          src/navigation/RootNavigator.tsx 에 등록하세요.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  title: {
    ...typography.subtitle,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  body: {
    ...typography.body,
    color: colors.textMuted,
    lineHeight: 22,
  },
});
