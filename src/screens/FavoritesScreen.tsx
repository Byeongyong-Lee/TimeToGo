import { useNavigation } from '@react-navigation/native';
import React from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { busApi } from '@/api/busApi';
import Button from '@/components/Button';
import Screen from '@/components/Screen';
import { useAsync } from '@/hooks/useAsync';
import { useNow } from '@/hooks/useNow';
import { selectFavorites, useFavoritesStore } from '@/store/favoritesStore';
import { colors, radius, spacing, typography } from '@/theme';
import { isAlarmActiveAt } from '@/types/alarm';
import { formatSecondsLeft, type Arrival, type Favorite } from '@/types/bus';

type ArrivalsData = {
  /** 조회 시점. 이후 흐른 시간만큼 남은 시간을 깎아서 보여줍니다. */
  fetchedAt: number;
  /** `${nodeId}:${routeId}` → 도착 목록 (가까운 순) */
  arrivals: Record<string, Arrival[]>;
};

/**
 * 앱을 켜면 바로 보이는 화면.
 *
 * 검색 없이 등록해둔 정류장·노선의 남은 시간만 보여주는 게 이 앱의 전부입니다.
 * 남은 시간은 조회 시점 기준으로 1초마다 깎이고, 당겨서 새로고침하면 다시 조회합니다.
 */
export default function FavoritesScreen() {
  const navigation = useNavigation();
  const favorites = useFavoritesStore(selectFavorites);
  const remove = useFavoritesStore(state => state.remove);

  // 즐겨찾기가 바뀌면(추가/삭제) 도착정보를 다시 조회합니다.
  const favoritesKey = favorites.map(f => f.id).join('|');
  const { data, loading, error, refetch } = useAsync<ArrivalsData>(async () => {
    const stops = new Map<string, Favorite>();
    for (const favorite of favorites) {
      stops.set(`${favorite.cityCode}:${favorite.nodeId}`, favorite);
    }
    const results = await Promise.all(
      [...stops.values()].map(async stop => ({
        nodeId: stop.nodeId,
        arrivals: await busApi.getArrivals(stop.cityCode, stop.nodeId),
      })),
    );
    const arrivals: ArrivalsData['arrivals'] = {};
    for (const result of results) {
      for (const arrival of result.arrivals) {
        (arrivals[`${result.nodeId}:${arrival.routeId}`] ??= []).push(arrival);
      }
    }
    return { fetchedAt: Date.now(), arrivals };
  }, [favoritesKey]);

  const now = useNow(1000);
  const elapsedSeconds = data ? Math.floor((now - data.fetchedAt) / 1000) : 0;

  const confirmRemove = (favorite: Favorite) => {
    Alert.alert(
      '노선 삭제',
      `${favorite.stopName} 정류장의 ${favorite.routeNo}번을 삭제할까요?`,
      [
        { text: '취소', style: 'cancel' },
        { text: '삭제', style: 'destructive', onPress: () => remove(favorite.id) },
      ],
    );
  };

  const header = (
    <View style={styles.header}>
      <Text style={styles.headerTitle}>나갈시간</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="정류장 검색"
        hitSlop={8}
        onPress={() => navigation.navigate('StopSearch')}
        style={({ pressed }) => pressed && styles.pressed}
      >
        <Text style={styles.headerAdd}>＋ 추가</Text>
      </Pressable>
    </View>
  );

  if (favorites.length === 0) {
    return (
      <Screen>
        {header}
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>등록된 노선이 없습니다</Text>
          <Text style={styles.emptyBody}>
            자주 타는 정류장과 노선을 등록해두면, 앱을 열자마자 남은 시간이
            바로 보입니다.
          </Text>
          <Button
            label="정류장 검색하기"
            onPress={() => navigation.navigate('StopSearch')}
            style={styles.emptyButton}
          />
        </View>
      </Screen>
    );
  }

  if (!data && loading) {
    return (
      <Screen>
        {header}
        <View style={styles.empty}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </Screen>
    );
  }

  if (!data && error) {
    return (
      <Screen>
        {header}
        <View style={styles.empty}>
          <Text style={styles.emptyBody}>{error}</Text>
          <Button
            label="다시 시도"
            variant="secondary"
            onPress={refetch}
            style={styles.emptyButton}
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <View style={styles.headerPadded}>{header}</View>
      <FlatList
        data={favorites}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={refetch}
            tintColor={colors.primary}
          />
        }
        ListFooterComponent={
          <Text style={styles.footerHint}>
            탭해서 알림 설정 · 길게 눌러 삭제 · 당겨서 새로고침
          </Text>
        }
        renderItem={({ item }) => (
          <FavoriteRow
            favorite={item}
            arrivals={data?.arrivals[`${item.nodeId}:${item.routeId}`] ?? []}
            elapsedSeconds={elapsedSeconds}
            now={now}
            onPress={() =>
              navigation.navigate('FavoriteAlarm', { favoriteId: item.id })
            }
            onLongPress={() => confirmRemove(item)}
          />
        )}
      />
    </Screen>
  );
}

function FavoriteRow({
  favorite,
  arrivals,
  elapsedSeconds,
  now,
  onPress,
  onLongPress,
}: {
  favorite: Favorite;
  arrivals: Arrival[];
  elapsedSeconds: number;
  now: number;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const first = arrivals[0];
  const second = arrivals[1];
  const remaining = first
    ? Math.max(first.secondsLeft - elapsedSeconds, 0)
    : null;

  const active = isAlarmActiveAt(favorite.alarm, new Date(now));
  const status = !favorite.alarm.enabled
    ? '알림 꺼짐'
    : active
    ? '알림 활성'
    : '알림 대기';

  const captionParts: string[] = [];
  if (first?.stopsLeft != null) {
    captionParts.push(`${first.stopsLeft}개 정류장 전`);
  }
  if (second) {
    captionParts.push(
      `다음 ${formatSecondsLeft(
        Math.max(second.secondsLeft - elapsedSeconds, 0),
      )}`,
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint="누르면 알림 설정, 길게 누르면 삭제할 수 있습니다"
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <Text style={styles.routeNo}>{favorite.routeNo}</Text>
      <View style={styles.rowBody}>
        <Text style={styles.stopName} numberOfLines={1}>
          {favorite.stopName}
        </Text>
        <Text style={styles.caption} numberOfLines={1}>
          <Text style={active ? styles.statusActive : styles.statusIdle}>
            {status}
          </Text>
          {captionParts.length > 0 ? ` · ${captionParts.join(' · ')}` : ''}
        </Text>
      </View>
      <Text style={[styles.time, remaining == null && styles.timeEmpty]}>
        {remaining != null ? formatSecondsLeft(remaining) : '정보 없음'}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  headerPadded: {
    paddingHorizontal: spacing.md,
  },
  headerTitle: {
    ...typography.title,
    color: colors.text,
  },
  headerAdd: {
    ...typography.subtitle,
    color: colors.primary,
  },
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
  emptyButton: {
    marginTop: spacing.lg,
    alignSelf: 'stretch',
  },
  list: {
    padding: spacing.md,
    paddingTop: 0,
    gap: spacing.sm,
  },
  footerHint: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    gap: spacing.md,
  },
  pressed: {
    opacity: 0.7,
  },
  routeNo: {
    ...typography.subtitle,
    color: colors.primary,
    minWidth: 64,
  },
  rowBody: {
    flex: 1,
  },
  stopName: {
    ...typography.body,
    color: colors.text,
  },
  caption: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  statusActive: {
    color: colors.success,
    fontWeight: '600',
  },
  statusIdle: {
    color: colors.textMuted,
  },
  time: {
    ...typography.subtitle,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  timeEmpty: {
    ...typography.caption,
    color: colors.textMuted,
  },
});
