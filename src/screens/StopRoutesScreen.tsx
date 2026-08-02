import { useRoute, type RouteProp } from '@react-navigation/native';
import React from 'react';
import {
  ActivityIndicator,
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
import type { RootStackParamList } from '@/navigation/types';
import { useFavoritesStore } from '@/store/favoritesStore';
import { colors, radius, spacing, typography } from '@/theme';
import {
  favoriteId,
  formatSecondsLeft,
  type Arrival,
  type BusRoute,
} from '@/types/bus';

type StopRoutesData = {
  routes: BusRoute[];
  /** routeId → 도착 목록 (가까운 순) */
  arrivalsByRoute: Record<string, Arrival[]>;
};

/**
 * 정류장 하나의 노선 목록.
 * 노선마다 도착정보를 미리 보여주고, 즐겨찾기 등록/해제를 토글합니다.
 */
export default function StopRoutesScreen() {
  const { params } = useRoute<RouteProp<RootStackParamList, 'StopRoutes'>>();
  const { stop } = params;

  const { data, loading, error, refetch } = useAsync<StopRoutesData>(async () => {
    const [routes, arrivals] = await Promise.all([
      busApi.getRoutesAtStop(stop),
      busApi.getArrivals(stop.cityCode, stop.nodeId),
    ]);
    const arrivalsByRoute: Record<string, Arrival[]> = {};
    for (const arrival of arrivals) {
      (arrivalsByRoute[arrival.routeId] ??= []).push(arrival);
    }
    return { routes, arrivalsByRoute };
  }, [stop.nodeId]);

  if (!data && loading) {
    return (
      <Screen edges={['bottom']}>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen edges={['bottom']}>
        <View style={styles.centered}>
          <Text style={styles.hint}>{error}</Text>
          <Button
            label="다시 시도"
            variant="secondary"
            onPress={refetch}
            style={styles.retry}
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen padded={false} edges={['bottom']}>
      <FlatList
        data={data?.routes ?? []}
        keyExtractor={item => item.routeId}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={refetch}
            tintColor={colors.primary}
          />
        }
        ListHeaderComponent={
          <Text style={styles.listHint}>
            등록한 노선은 홈 화면에서 남은 시간이 바로 보입니다.
          </Text>
        }
        renderItem={({ item }) => (
          <RouteRow
            route={item}
            arrivals={data?.arrivalsByRoute[item.routeId] ?? []}
            stop={stop}
          />
        )}
      />
    </Screen>
  );
}

function RouteRow({
  route,
  arrivals,
  stop,
}: {
  route: BusRoute;
  arrivals: Arrival[];
  stop: RootStackParamList['StopRoutes']['stop'];
}) {
  const id = favoriteId(stop.cityCode, stop.nodeId, route.routeId);
  const isFavorite = useFavoritesStore(state =>
    state.favorites.some(f => f.id === id),
  );
  const add = useFavoritesStore(state => state.add);
  const remove = useFavoritesStore(state => state.remove);

  const first = arrivals[0];
  const second = arrivals[1];
  const arrivalText = first
    ? `${formatSecondsLeft(first.secondsLeft)}${
        second ? ` · 다음 ${formatSecondsLeft(second.secondsLeft)}` : ''
      }`
    : '도착 정보 없음';

  const toggle = () => {
    if (isFavorite) {
      remove(id);
    } else {
      add({
        cityCode: stop.cityCode,
        nodeId: stop.nodeId,
        stopName: stop.name,
        routeId: route.routeId,
        routeNo: route.routeNo,
      });
    }
  };

  return (
    <View style={styles.row}>
      <View style={styles.routeHead}>
        <Text style={styles.routeNo}>{route.routeNo}</Text>
        {route.routeType ? (
          <Text style={styles.routeType}>{route.routeType}</Text>
        ) : null}
      </View>
      <Text
        style={[styles.arrival, !first && styles.arrivalEmpty]}
        numberOfLines={1}
      >
        {arrivalText}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: isFavorite }}
        onPress={toggle}
        style={({ pressed }) => [
          styles.toggle,
          isFavorite && styles.toggleOn,
          pressed && styles.pressed,
        ]}
      >
        <Text style={[styles.toggleLabel, isFavorite && styles.toggleLabelOn]}>
          {isFavorite ? '등록됨 ✓' : '＋ 등록'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: spacing.xl,
  },
  hint: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
  retry: {
    marginTop: spacing.md,
    alignSelf: 'stretch',
  },
  list: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  listHint: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    gap: spacing.md,
  },
  routeHead: {
    minWidth: 72,
  },
  routeNo: {
    ...typography.subtitle,
    color: colors.primary,
  },
  routeType: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  arrival: {
    ...typography.body,
    color: colors.text,
    flex: 1,
  },
  arrivalEmpty: {
    color: colors.textMuted,
  },
  toggle: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  toggleOn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  pressed: {
    opacity: 0.7,
  },
  toggleLabel: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.text,
  },
  toggleLabelOn: {
    color: colors.primaryText,
  },
});
