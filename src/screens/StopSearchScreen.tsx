import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { busApi } from '@/api/busApi';
import Button from '@/components/Button';
import CitySelect from '@/components/CitySelect';
import Screen from '@/components/Screen';
import TextField from '@/components/TextField';
import { useAsync } from '@/hooks/useAsync';
import { selectCityCode, useSettingsStore } from '@/store/settingsStore';
import { colors, radius, spacing, typography } from '@/theme';
import type { BusStop } from '@/types/bus';

/**
 * 정류장 이름/번호로 검색하는 화면.
 * 결과를 누르면 그 정류장의 노선 목록(StopRoutes)으로 이동합니다.
 */
export default function StopSearchScreen() {
  const navigation = useNavigation();
  const [keyword, setKeyword] = useState('');
  const [debounced, setDebounced] = useState('');
  // 검색은 이 지역 안에서만 됩니다. 지역이 바뀌면 같은 키워드로 다시 검색합니다.
  const cityCode = useSettingsStore(selectCityCode);

  // 타이핑이 멈추고 300ms 뒤에 검색합니다.
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(keyword.trim()), 300);
    return () => clearTimeout(timer);
  }, [keyword]);

  const { data, loading, error, refetch } = useAsync<BusStop[]>(
    () => (debounced ? busApi.searchStops(debounced) : Promise.resolve([])),
    [debounced, cityCode],
  );

  return (
    <Screen edges={['bottom']}>
      <View style={styles.searchBox}>
        <CitySelect style={styles.city} />
        <TextField
          label="정류장 이름 또는 번호"
          placeholder="예) 시청, 대학교, 21120"
          value={keyword}
          onChangeText={setKeyword}
          autoFocus
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
      </View>

      {!debounced ? (
        <View style={styles.centered}>
          <Text style={styles.hint}>
            자주 타는 정류장을 검색해서{'\n'}노선을 등록해보세요.
          </Text>
        </View>
      ) : loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.hint}>{error}</Text>
          <Button
            label="다시 시도"
            variant="secondary"
            onPress={refetch}
            style={styles.retry}
          />
        </View>
      ) : data && data.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.hint}>
            '{debounced}' 검색 결과가 없습니다.{'\n'}
            다른 지역의 정류장이라면 위에서 지역을 바꿔보세요.
          </Text>
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={item => item.nodeId}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              onPress={() => navigation.navigate('StopRoutes', { stop: item })}
            >
              <View style={styles.rowBody}>
                <Text style={styles.stopName}>{item.name}</Text>
                {item.number ? (
                  <Text style={styles.stopNumber}>정류장 번호 {item.number}</Text>
                ) : null}
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  searchBox: {
    paddingTop: spacing.md,
  },
  city: {
    marginBottom: spacing.md,
  },
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
    gap: spacing.sm,
    paddingBottom: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  pressed: {
    opacity: 0.7,
  },
  rowBody: {
    flex: 1,
  },
  stopName: {
    ...typography.subtitle,
    color: colors.text,
  },
  stopNumber: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  chevron: {
    ...typography.title,
    color: colors.textMuted,
  },
});
