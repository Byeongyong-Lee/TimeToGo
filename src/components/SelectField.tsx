import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ViewStyle,
} from 'react-native';

import { colors, radius, spacing, typography } from '@/theme';

export type SelectOption<T> = {
  label: string;
  value: T;
};

type Props<T> = {
  /** 접근성 라벨 겸 모달 제목 */
  label: string;
  value: T;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  /** 옵션이 많을 때 모달 상단에 검색창을 띄웁니다. */
  searchable?: boolean;
  searchPlaceholder?: string;
  style?: ViewStyle;
};

const ITEM_HEIGHT = 48;

/**
 * 셀렉트 박스. 누르면 모달로 옵션 목록이 열립니다.
 *
 * 네이티브 피커(@react-native-picker/picker)를 안 쓰고 JS 로만 구현해서
 * 추가 네이티브 빌드 없이 동작합니다.
 */
export default function SelectField<T>({
  label,
  value,
  options,
  onChange,
  searchable = false,
  searchPlaceholder = '검색',
  style,
}: Props<T>) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selected = options.find(option => option.value === value);

  // 공백을 무시하고 부분일치로 거릅니다. ("대전 광역시" 로도 걸리도록)
  const visible = useMemo(() => {
    const normalized = query.trim().replace(/\s/g, '');
    if (!searchable || !normalized) {
      return options;
    }
    return options.filter(option =>
      option.label.replace(/\s/g, '').includes(normalized),
    );
  }, [options, query, searchable]);

  const selectedIndex = Math.max(
    visible.findIndex(option => option.value === value),
    0,
  );

  const close = () => {
    setOpen(false);
    setQuery('');
  };

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityValue={{ text: selected?.label ?? String(value) }}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.field, pressed && styles.pressed, style]}
      >
        <Text style={styles.fieldLabel} numberOfLines={1}>
          {selected?.label ?? String(value)}
        </Text>
        <Text style={styles.chevron}>▾</Text>
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={close}
      >
        <Pressable style={styles.overlay} onPress={close}>
          {/* 시트 내부 터치가 오버레이 닫기로 전파되지 않도록 감쌉니다. */}
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetTitle}>{label}</Text>

            {searchable ? (
              <View style={styles.searchBox}>
                <TextInput
                  style={styles.search}
                  value={query}
                  onChangeText={setQuery}
                  placeholder={searchPlaceholder}
                  placeholderTextColor={colors.textMuted}
                  autoCorrect={false}
                  clearButtonMode="while-editing"
                />
              </View>
            ) : null}

            <FlatList
              data={visible}
              keyExtractor={(_, index) => String(index)}
              keyboardShouldPersistTaps="handled"
              // 목록이 걸러진 상태에서는 저장된 위치로 점프하지 않습니다.
              initialScrollIndex={visible.length > 0 ? selectedIndex : undefined}
              getItemLayout={(_, index) => ({
                length: ITEM_HEIGHT,
                offset: ITEM_HEIGHT * index,
                index,
              })}
              style={styles.list}
              ListEmptyComponent={
                <Text style={styles.empty}>검색 결과가 없습니다.</Text>
              }
              renderItem={({ item }) => {
                const isSelected = item.value === value;
                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    onPress={() => {
                      onChange(item.value);
                      close();
                    }}
                    style={({ pressed }) => [
                      styles.item,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text
                      style={[styles.itemLabel, isSelected && styles.itemLabelOn]}
                    >
                      {item.label}
                    </Text>
                    {isSelected ? <Text style={styles.check}>✓</Text> : null}
                  </Pressable>
                );
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.background,
    gap: spacing.sm,
  },
  fieldLabel: {
    ...typography.body,
    color: colors.text,
    fontVariant: ['tabular-nums'],
    flexShrink: 1,
  },
  chevron: {
    ...typography.caption,
    color: colors.textMuted,
  },
  pressed: {
    opacity: 0.7,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  sheet: {
    alignSelf: 'stretch',
    maxHeight: '60%',
    borderRadius: radius.lg,
    backgroundColor: colors.background,
    paddingVertical: spacing.sm,
  },
  sheetTitle: {
    ...typography.caption,
    color: colors.textMuted,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  searchBox: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  search: {
    height: 44,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  empty: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
  list: {
    flexGrow: 0,
  },
  item: {
    height: ITEM_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
  },
  itemLabel: {
    ...typography.body,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  itemLabelOn: {
    color: colors.primary,
    fontWeight: '600',
  },
  check: {
    ...typography.body,
    color: colors.primary,
  },
});
