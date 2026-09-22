import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';

/**
 * The circular countdown from the item-detail design.
 *
 * Geometry is taken verbatim from the export's SVG — viewBox 0 0 160 160,
 * r = 66, an 8px track under a 9px rounded progress stroke, rotated -90 degrees
 * so the arc starts at twelve o'clock. Only the colours differ: the export
 * hardcodes an indigo gradient, and these come from theme tokens so the ring
 * works in both schemes.
 */

export const RING_RADIUS = 66;
export const RING_VIEWBOX = 160;
export const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

/**
 * How much of the circle to leave unpainted for a given fraction.
 *
 * Pure and exported so the arc maths is testable without rendering: a full ring
 * is offset 0, an empty one is offset by the whole circumference, and anything
 * outside 0-1 is clamped rather than drawing a nonsensical arc.
 */
export function dashOffsetFor(fraction: number, circumference = RING_CIRCUMFERENCE): number {
  if (!Number.isFinite(fraction)) {
    return circumference;
  }

  const clamped = Math.min(1, Math.max(0, fraction));

  return circumference * (1 - clamped);
}

export interface CountdownRingProps {
  /** 0-1. The portion of the document's life still remaining. */
  fraction: number;
  /** Drawn inside the ring. */
  children?: React.ReactNode;
  /** Overrides the gradient, so an expired ring can render in the error tone. */
  tone?: string;
  size?: number;
  testID?: string;
}

/** The rendered diameter; the export draws it at 176. */
const DEFAULT_SIZE = 176;

export function CountdownRing({
  fraction,
  children,
  tone,
  size = DEFAULT_SIZE,
  testID,
}: CountdownRingProps) {
  const theme = useTheme();
  const offset = dashOffsetFor(fraction);

  return (
    <View style={[styles.wrapper, { height: size, width: size }]} testID={testID}>
      <Svg
        // Rotated so the arc begins at the top rather than at three o'clock.
        style={styles.svg}
        viewBox={`0 0 ${RING_VIEWBOX} ${RING_VIEWBOX}`}
      >
        <Defs>
          <LinearGradient id="countdownGradient" x1="0%" x2="100%" y1="0%" y2="100%">
            <Stop offset="0%" stopColor={tone ?? theme.colors.primaryContainer} />
            <Stop offset="60%" stopColor={tone ?? theme.colors.primary} />
            <Stop offset="100%" stopColor={tone ?? theme.colors.primary} />
          </LinearGradient>
        </Defs>

        <Circle
          cx={RING_VIEWBOX / 2}
          cy={RING_VIEWBOX / 2}
          fill="transparent"
          r={RING_RADIUS}
          stroke={theme.colors.surfaceContainerHighest}
          strokeWidth={8}
        />

        <Circle
          cx={RING_VIEWBOX / 2}
          cy={RING_VIEWBOX / 2}
          fill="transparent"
          r={RING_RADIUS}
          stroke="url(#countdownGradient)"
          strokeDasharray={RING_CIRCUMFERENCE}
          strokeDashoffset={offset}
          strokeLinecap="round"
          strokeWidth={9}
        />
      </Svg>

      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    alignItems: 'center',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  svg: { transform: [{ rotate: '-90deg' }] },
  wrapper: { alignItems: 'center', justifyContent: 'center' },
});
