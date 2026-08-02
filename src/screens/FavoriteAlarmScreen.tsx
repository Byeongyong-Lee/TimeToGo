import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import React, { useEffect } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';

import Button from '@/components/Button';
import Screen from '@/components/Screen';
import SelectField, { type SelectOption } from '@/components/SelectField';
import { useNow } from '@/hooks/useNow';
import type { RootStackParamList } from '@/navigation/types';
import { useFavoritesStore } from '@/store/favoritesStore';
import { colors, radius, spacing, typography } from '@/theme';
import {
  DAY_ORDER,
  formatAlarmDays,
  formatIntervalSec,
  formatMinutesOfDay,
  isAlarmActiveAt,
  type FavoriteAlarm,
} from '@/types/alarm';

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];
const INTERVAL_OPTIONS: FavoriteAlarm['intervalSec'][] = [30, 60];

/** 알림 시작 시점 선택지: 남은 1~30분 */
const NOTIFY_FROM_OPTIONS: SelectOption<number>[] = Array.from(
  { length: 30 },
  (_, i) => ({ label: `${i + 1}분 전부터`, value: i + 1 }),
);

/**
 * 즐겨찾기 하나의 알림 세부 설정.
 *
 * 여기서 정한 요일·시간대에 들어왔을 때만 "활성"이 되어 푸시알림 대상이
 * 됩니다. 그 외 시간에는 홈 목록에 보이기만 하고 알림은 가지 않습니다.
 */
export default function FavoriteAlarmScreen() {
  const { params } = useRoute<RouteProp<RootStackParamList, 'FavoriteAlarm'>>();
  const navigation = useNavigation();
  const favorite = useFavoritesStore(state =>
    state.favorites.find(f => f.id === params.favoriteId),
  );
  const updateAlarm = useFavoritesStore(state => state.updateAlarm);
  const remove = useFavoritesStore(state => state.remove);
  const now = useNow(10_000);

  useEffect(() => {
    if (favorite) {
      navigation.setOptions({
        title: `${favorite.routeNo} · ${favorite.stopName}`,
      });
    }
  }, [favorite, navigation]);

  // 삭제 후 등 즐겨찾기가 사라졌으면 되돌아갑니다.
  useEffect(() => {
    if (!favorite && navigation.canGoBack()) {
      navigation.goBack();
    }
  }, [favorite, navigation]);

  if (!favorite) {
    return null;
  }

  const { alarm } = favorite;
  const patch = (p: Partial<FavoriteAlarm>) => updateAlarm(favorite.id, p);
  const active = isAlarmActiveAt(alarm, new Date(now));

  const toggleDay = (day: number) => {
    patch({
      days: alarm.days.includes(day)
        ? alarm.days.filter(d => d !== day)
        : [...alarm.days, day],
    });
  };

  const confirmRemove = () => {
    Alert.alert(
      '노선 삭제',
      `${favorite.stopName} 정류장의 ${favorite.routeNo}번을 삭제할까요?`,
      [
        { text: '취소', style: 'cancel' },
        { text: '삭제', style: 'destructive', onPress: () => remove(favorite.id) },
      ],
    );
  };

  return (
    <Screen edges={['bottom']} padded={false}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* 활성/비활성 */}
        <View style={styles.switchRow}>
          <View style={styles.switchLabelBox}>
            <Text style={styles.switchLabel}>알림 사용</Text>
            <Text style={styles.switchHint}>
              꺼도 목록에는 계속 보이고, 알림만 가지 않습니다.
            </Text>
          </View>
          <Switch
            value={alarm.enabled}
            onValueChange={enabled => patch({ enabled })}
            trackColor={{ true: colors.primary, false: colors.border }}
            thumbColor={colors.background}
          />
        </View>

        {/* 요일 */}
        <Text style={styles.sectionLabel}>요일</Text>
        <View style={styles.dayRow}>
          {DAY_ORDER.map(day => {
            const selected = alarm.days.includes(day);
            return (
              <Pressable
                key={day}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => toggleDay(day)}
                style={({ pressed }) => [
                  styles.dayChip,
                  selected && styles.chipOn,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.chipLabel, selected && styles.chipLabelOn]}>
                  {DAY_LABELS[day]}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {alarm.days.length === 0 ? (
          <Text style={styles.warn}>요일을 하나 이상 선택해야 알림이 갑니다.</Text>
        ) : null}

        {/* 시간대 */}
        <Text style={styles.sectionLabel}>활성 시간대</Text>
        <TimeField
          label="시작"
          minutes={alarm.startMinutes}
          onChange={startMinutes => patch({ startMinutes })}
        />
        <TimeField
          label="종료"
          minutes={alarm.endMinutes}
          onChange={endMinutes => patch({ endMinutes })}
        />
        {alarm.startMinutes > alarm.endMinutes ? (
          <Text style={styles.hint}>
            종료가 시작보다 이르면 자정을 넘는 시간대(
            {formatMinutesOfDay(alarm.startMinutes)}~
            {formatMinutesOfDay(alarm.endMinutes)})로 동작합니다.
          </Text>
        ) : null}

        {/* 알림 주기 */}
        <Text style={styles.sectionLabel}>알림 주기</Text>
        <View style={styles.chipRow}>
          {INTERVAL_OPTIONS.map(option => {
            const selected = alarm.intervalSec === option;
            return (
              <Pressable
                key={option}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => patch({ intervalSec: option })}
                style={({ pressed }) => [
                  styles.chip,
                  selected && styles.chipOn,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.chipLabel, selected && styles.chipLabelOn]}>
                  {formatIntervalSec(option)}마다
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* 알림 시작 시점 */}
        <Text style={styles.sectionLabel}>알림 시작</Text>
        <View style={styles.notifyFromRow}>
          <Text style={styles.notifyFromText}>남은 시간</Text>
          <SelectField
            label="알림 시작 시점"
            value={alarm.notifyFromMinutes}
            options={NOTIFY_FROM_OPTIONS}
            onChange={notifyFromMinutes => patch({ notifyFromMinutes })}
            style={styles.notifyFromSelect}
          />
        </View>

        {/* 요약 */}
        <View style={styles.summary}>
          <Text style={[styles.summaryStatus, active && styles.summaryActive]}>
            {alarm.enabled
              ? active
                ? '지금 알림 활성 시간대입니다'
                : '지금은 알림 대기 중입니다'
              : '알림이 꺼져 있습니다'}
          </Text>
          <Text style={styles.summaryText}>
            {formatAlarmDays(alarm.days)}{' '}
            {formatMinutesOfDay(alarm.startMinutes)}~
            {formatMinutesOfDay(alarm.endMinutes)} · 남은{' '}
            {alarm.notifyFromMinutes}분부터 {formatIntervalSec(alarm.intervalSec)}{' '}
            간격
          </Text>
          <Text style={styles.summaryNote}>
            앱이 실행 중일 때 조건이 맞으면 푸시가 옵니다. 앱을 완전히 끈
            상태의 알림은 아직 지원하지 않습니다.
          </Text>
        </View>

        <Button
          label="이 노선 삭제"
          variant="secondary"
          onPress={confirmRemove}
          style={styles.removeButton}
        />
      </ScrollView>
    </Screen>
  );
}

const HOUR_OPTIONS: SelectOption<number>[] = Array.from(
  { length: 24 },
  (_, hour) => ({ label: `${String(hour).padStart(2, '0')}시`, value: hour }),
);

/** 5분 단위. 저장된 값이 5분 단위가 아니면 그 값도 목록에 끼워 넣습니다. */
function minuteOptions(current: number): SelectOption<number>[] {
  const values = Array.from({ length: 12 }, (_, i) => i * 5);
  if (!values.includes(current)) {
    values.push(current);
    values.sort((a, b) => a - b);
  }
  return values.map(minute => ({
    label: `${String(minute).padStart(2, '0')}분`,
    value: minute,
  }));
}

/** 시·분을 각각 셀렉트 박스로 고르는 시간 입력 */
function TimeField({
  label,
  minutes,
  onChange,
}: {
  label: string;
  minutes: number;
  onChange: (minutes: number) => void;
}) {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;

  return (
    <View style={styles.timeRow}>
      <Text style={styles.timeLabel}>{label}</Text>
      <View style={styles.timeSelects}>
        <SelectField
          label={`${label} 시`}
          value={hour}
          options={HOUR_OPTIONS}
          onChange={h => onChange(h * 60 + minute)}
          style={styles.timeSelect}
        />
        <SelectField
          label={`${label} 분`}
          value={minute}
          options={minuteOptions(minute)}
          onChange={m => onChange(hour * 60 + m)}
          style={styles.timeSelect}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  switchLabelBox: {
    flex: 1,
  },
  switchLabel: {
    ...typography.subtitle,
    color: colors.text,
  },
  switchHint: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  sectionLabel: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  dayRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  dayChip: {
    flex: 1,
    height: 40,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    height: 40,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipOn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipLabel: {
    ...typography.body,
    color: colors.text,
  },
  chipLabelOn: {
    color: colors.primaryText,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.7,
  },
  warn: {
    ...typography.caption,
    color: colors.danger,
    marginTop: spacing.sm,
  },
  hint: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    marginBottom: spacing.sm,
  },
  timeLabel: {
    ...typography.body,
    color: colors.textMuted,
    width: 32,
  },
  timeSelects: {
    flex: 1,
    flexDirection: 'row',
    gap: spacing.sm,
  },
  timeSelect: {
    flex: 1,
  },
  notifyFromRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    gap: spacing.md,
  },
  notifyFromText: {
    ...typography.body,
    color: colors.textMuted,
  },
  notifyFromSelect: {
    flex: 1,
  },
  summary: {
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  summaryStatus: {
    ...typography.subtitle,
    color: colors.textMuted,
  },
  summaryActive: {
    color: colors.success,
  },
  summaryText: {
    ...typography.body,
    color: colors.text,
    marginTop: spacing.xs,
  },
  summaryNote: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  removeButton: {
    marginTop: spacing.lg,
  },
});
