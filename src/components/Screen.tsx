import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { useTheme } from '@/theme';

export interface ScreenProps {
  children: ReactNode;
  /** Wraps content in a ScrollView. Off by default so fixed layouts stay fixed. */
  scroll?: boolean;
  /** Applies the design's 20px outer margin. */
  padded?: boolean;
  edges?: readonly Edge[];
  testID?: string;
}

export function Screen({
  children,
  scroll = false,
  padded = true,
  edges = ['top', 'bottom', 'left', 'right'],
  testID,
}: ScreenProps) {
  const theme = useTheme();
  const contentStyle = padded ? { padding: theme.spacing.margin } : null;

  return (
    <SafeAreaView
      edges={edges}
      style={[styles.fill, { backgroundColor: theme.colors.surface }]}
      testID={testID}
    >
      <KeyboardAvoidingView
        behavior={Platform.select({ ios: 'padding', default: 'height' })}
        style={styles.fill}
      >
        {scroll ? (
          <ScrollView
            contentContainerStyle={contentStyle}
            keyboardShouldPersistTaps="handled"
            style={styles.fill}
          >
            {children}
          </ScrollView>
        ) : (
          <View style={[styles.fill, contentStyle]}>{children}</View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
