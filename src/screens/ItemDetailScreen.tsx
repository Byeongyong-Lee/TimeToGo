import type { RouteProp } from '@react-navigation/native';
import { useRoute } from '@react-navigation/native';
import React from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text } from 'react-native';

import { itemsApi } from '@/api/items';
import Button from '@/components/Button';
import Screen from '@/components/Screen';
import { useAsync } from '@/hooks/useAsync';
import type { RootStackParamList } from '@/navigation/types';
import { colors, spacing, typography } from '@/theme';

type DetailRoute = RouteProp<RootStackParamList, 'ItemDetail'>;

export default function ItemDetailScreen() {
  const { params } = useRoute<DetailRoute>();
  const { data, loading, error, refetch } = useAsync(
    () => itemsApi.detail(params.id),
    [params.id],
  );

  if (loading && !data) {
    return (
      <Screen>
        <ActivityIndicator style={styles.loader} color={colors.primary} />
      </Screen>
    );
  }

  if (error && !data) {
    return (
      <Screen>
        <Text style={styles.error}>{error}</Text>
        <Button
          label="다시 시도"
          variant="secondary"
          onPress={() => {
            refetch();
          }}
        />
      </Screen>
    );
  }

  return (
    <Screen edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>{data?.title}</Text>
        <Text style={styles.meta}>{data?.createdAt}</Text>
        <Text style={styles.body}>{data?.description}</Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  loader: {
    marginTop: spacing.xl,
  },
  content: {
    paddingVertical: spacing.lg,
    gap: spacing.sm,
  },
  title: {
    ...typography.title,
    color: colors.text,
  },
  meta: {
    ...typography.caption,
    color: colors.textMuted,
  },
  body: {
    ...typography.body,
    color: colors.text,
    lineHeight: 22,
    marginTop: spacing.sm,
  },
  error: {
    ...typography.body,
    color: colors.danger,
    marginVertical: spacing.md,
  },
});
