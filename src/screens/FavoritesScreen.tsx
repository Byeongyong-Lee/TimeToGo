import React from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import Screen from '@/components/Screen';
import { selectFavorites, useFavoritesStore } from '@/store/favoritesStore';
import { colors, radius, spacing, typography } from '@/theme';
import type { Favorite } from '@/types/bus';

/**
 * 앱을 켜면 바로 보이는 화면.
 *
 * 검색 없이 등록해둔 정류장·노선의 남은 시간만 보여주는 게 이 앱의 전부입니다.
 * 도착시간 조회는 공공데이터포털 인증키를 받은 뒤 붙입니다.
 */
export default function FavoritesScreen() {
  const favorites = useFavoritesStore(selectFavorites);

  if (favorites.length === 0) {
    return (
      <Screen>
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>등록된 노선이 없습니다</Text>
          <Text style={styles.emptyBody}>
            자주 타는 정류장과 노선을 등록해두면, 앱을 열자마자 남은 시간이
            바로 보입니다.
          </Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <FlatList
        data={favorites}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => <FavoriteRow favorite={item} />}
      />
    </Screen>
  );
}

function FavoriteRow({ favorite }: { favorite: Favorite }) {
  return (
    <View style={styles.row}>
      <Text style={styles.routeNo}>{favorite.routeNo}</Text>
      <View style={styles.rowBody}>
        <Text style={styles.stopName} numberOfLines={1}>
          {favorite.stopName}
        </Text>
        {/* 도착시간은 API 연동 후 채웁니다. */}
        <Text style={styles.placeholder}>도착정보 준비 중</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: spacing.xl,
  },
  emptyTitle: {
    ...typography.subtitle,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  emptyBody: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
  list: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    gap: spacing.md,
  },
  routeNo: {
    ...typography.title,
    color: colors.primary,
    minWidth: 72,
  },
  rowBody: {
    flex: 1,
  },
  stopName: {
    ...typography.body,
    color: colors.text,
  },
  placeholder: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
});
