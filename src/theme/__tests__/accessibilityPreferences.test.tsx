import { act, render, screen } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { AccessibilityInfo, Text as RNText, useWindowDimensions } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import {
  interaction,
  MAX_LAYOUT_SCALE,
  STACK_THRESHOLD,
  ThemeProvider,
  useScaledSize,
  useStackedLayout,
  useTheme,
} from '@/theme';

/**
 * The two OS accessibility settings the UI answers to: text size and Reduce
 * Motion. Both are asserted through the theme rather than per component, since
 * that is where F13 centralised them.
 */

jest.mock('react-native/Libraries/Utilities/useWindowDimensions');
const mockUseWindowDimensions = jest.mocked(useWindowDimensions);

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

function dimensions(fontScale: number) {
  return { width: 390, height: 844, scale: 3, fontScale };
}

function renderWithTheme(ui: ReactElement) {
  return render(
    <SafeAreaProvider initialMetrics={metrics}>
      <ThemeProvider>{ui}</ThemeProvider>
    </SafeAreaProvider>,
  );
}

beforeEach(() => {
  mockUseWindowDimensions.mockReturnValue(dimensions(1));
});

describe('font scaling', () => {
  function StackProbe() {
    return <RNText>{useStackedLayout() ? 'stacked' : 'row'}</RNText>;
  }

  function SizeProbe() {
    return <RNText>{String(useScaledSize(100))}</RNText>;
  }

  it('keeps rows horizontal at the default text size', () => {
    renderWithTheme(<StackProbe />);

    expect(screen.getByText('row')).toBeOnTheScreen();
  });

  it('stacks rows once the threshold is reached', () => {
    mockUseWindowDimensions.mockReturnValue(dimensions(STACK_THRESHOLD));
    renderWithTheme(<StackProbe />);

    expect(screen.getByText('stacked')).toBeOnTheScreen();
  });

  it('stays horizontal just below the threshold', () => {
    mockUseWindowDimensions.mockReturnValue(dimensions(STACK_THRESHOLD - 0.01));
    renderWithTheme(<StackProbe />);

    expect(screen.getByText('row')).toBeOnTheScreen();
  });

  it('grows a fixed dimension with the text', () => {
    mockUseWindowDimensions.mockReturnValue(dimensions(1.5));
    renderWithTheme(<SizeProbe />);

    expect(screen.getByText('150')).toBeOnTheScreen();
  });

  /**
   * iOS reaches roughly 3.1x. Without the ceiling a 176pt ring would be drawn
   * at 545pt, which is wider than any phone.
   */
  it('stops growing at the layout ceiling', () => {
    mockUseWindowDimensions.mockReturnValue(dimensions(3.1));
    renderWithTheme(<SizeProbe />);

    expect(screen.getByText(String(100 * MAX_LAYOUT_SCALE))).toBeOnTheScreen();
  });
});

describe('reduce motion', () => {
  function MotionProbe() {
    const theme = useTheme();
    return <RNText>{`${String(theme.reduceMotion)}:${theme.interaction.pressedScale}`}</RNText>;
  }

  it('keeps the press animation when the setting is off', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);

    renderWithTheme(<MotionProbe />);
    await act(async () => {});

    expect(screen.getByText(`false:${interaction.pressedScale}`)).toBeOnTheScreen();
  });

  /**
   * The scale is neutralised on the theme, which is what reaches every button,
   * card, chip and tile at once rather than each of them opting in.
   */
  it('neutralises the press scale when the setting is on', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);

    renderWithTheme(<MotionProbe />);
    await act(async () => {});

    expect(screen.getByText('true:1')).toBeOnTheScreen();
  });

  it('leaves the other interaction tokens alone', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);

    function OpacityProbe() {
      return <RNText>{String(useTheme().interaction.pressedOpacity)}</RNText>;
    }

    renderWithTheme(<OpacityProbe />);
    await act(async () => {});

    expect(screen.getByText(String(interaction.pressedOpacity))).toBeOnTheScreen();
  });
});
