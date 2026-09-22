import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Animated,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme';

import { Text } from './Text';

export interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  testID?: string;
}

/** Past this fraction of the sheet's height, releasing the drag dismisses it. */
const DISMISS_FRACTION = 0.3;

export function BottomSheet({ visible, onClose, title, children, testID }: BottomSheetProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  // useState rather than useRef: reactCompiler is enabled, and reading a ref's
  // value during render (for the transform below) is unsafe under it.
  const [translateY] = useState(() => new Animated.Value(height));
  // Was subscribed here directly; now one theme-wide flag, so the sheet and
  // every press animation cannot disagree about the setting.
  const reduceMotion = theme.reduceMotion;

  useEffect(() => {
    Animated.timing(translateY, {
      toValue: visible ? 0 : height,
      duration: reduceMotion ? 0 : 240,
      useNativeDriver: true,
    }).start();
  }, [visible, height, reduceMotion, translateY]);

  // Rebuilt when its inputs change so the handlers never close over a stale
  // height or onClose.
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gesture) => gesture.dy > 4,
        onPanResponderMove: (_event, gesture) => {
          if (gesture.dy > 0) {
            translateY.setValue(gesture.dy);
          }
        },
        onPanResponderRelease: (_event, gesture) => {
          if (gesture.dy > height * DISMISS_FRACTION) {
            onClose();
          } else {
            Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
          }
        },
      }),
    [height, onClose, translateY],
  );

  return (
    <Modal
      animationType="none"
      // Android's hardware back button must close the sheet, not the screen.
      onRequestClose={onClose}
      transparent
      visible={visible}
    >
      <View style={styles.fill} testID={testID}>
        {/*
          Tap-to-dismiss is a pointer affordance only. The sheet below sets
          accessibilityViewIsModal, so the scrim is outside the accessibility
          tree by design — assistive tech dismisses via the back gesture or an
          explicit control in `children`, not by targeting the scrim.
        */}
        <Pressable
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          onPress={onClose}
          style={[styles.scrim, { backgroundColor: theme.colors.inverseSurface }]}
          testID={testID === undefined ? undefined : `${testID}-scrim`}
        />

        <Animated.View
          accessibilityViewIsModal
          style={[
            styles.sheet,
            {
              backgroundColor: theme.colors.surfaceContainerLowest,
              borderTopLeftRadius: theme.radius.xl,
              borderTopRightRadius: theme.radius.xl,
              gap: theme.spacing.md,
              paddingBottom: insets.bottom + theme.spacing.lg,
              paddingHorizontal: theme.spacing.margin,
              paddingTop: theme.spacing.sm,
              transform: [{ translateY }],
              ...theme.elevation.level2,
            },
          ]}
          {...panResponder.panHandlers}
        >
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={[
              styles.handle,
              {
                backgroundColor: theme.colors.outlineVariant,
                borderRadius: theme.radius.full,
              },
            ]}
          />

          <Text accessibilityRole="header" variant="titleLg">
            {title}
          </Text>

          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, justifyContent: 'flex-end' },
  // The export contains no bottom sheet, so the drag handle has no design
  // reference; these are the platform-conventional dimensions.
  handle: { alignSelf: 'center', height: 4, width: 36 },
  scrim: { bottom: 0, left: 0, opacity: 0.4, position: 'absolute', right: 0, top: 0 },
  sheet: { width: '100%' },
});
