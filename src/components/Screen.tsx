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
  /**
   * Set on a screen inside the native tab bar.
   *
   * The bar already sits on the bottom safe-area inset, and this library's
   * insets are window-level rather than per-view, so a tab screen that also
   * claims `bottom` pads for the home indicator a second time — once under the
   * tab bar, once above it.
   */
  tabBar?: boolean;
  testID?: string;
}

export function Screen({
  children,
  scroll = false,
  padded = true,
  edges,
  tabBar = false,
  testID,
}: ScreenProps) {
  const theme = useTheme();
  const resolvedEdges: readonly Edge[] =
    edges ?? (tabBar ? ['top', 'left', 'right'] : ['top', 'bottom', 'left', 'right']);
  const contentStyle = padded ? { padding: theme.spacing.margin } : null;

  return (
    <SafeAreaView
      edges={resolvedEdges}
      style={[styles.fill, { backgroundColor: theme.colors.surface }]}
      testID={testID}
    >
      {/*
        Android resizes the window itself under the default `adjustResize`, so
        `height` here adjusts a second time and the layout jumps as the keyboard
        opens. `undefined` leaves Android to the OS and keeps the padding
        behaviour iOS needs.
      */}
      <KeyboardAvoidingView
        behavior={Platform.select({ ios: 'padding', default: undefined })}
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
