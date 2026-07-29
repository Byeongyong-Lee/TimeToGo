import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { colors, spacing } from '@/theme';

type Props = {
  children: React.ReactNode;
  /** 기본은 좌우 여백 있음. 리스트 화면처럼 꽉 채워야 하면 false */
  padded?: boolean;
  edges?: readonly Edge[];
  style?: ViewStyle;
};

export default function Screen({
  children,
  padded = true,
  edges = ['top', 'bottom'],
  style,
}: Props) {
  return (
    <SafeAreaView style={styles.safe} edges={edges}>
      <View style={[styles.content, padded && styles.padded, style]}>
        {children}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
  },
  padded: {
    paddingHorizontal: spacing.md,
  },
});
