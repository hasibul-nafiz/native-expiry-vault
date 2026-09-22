import { render, screen, userEvent } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { Text as RNText, useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import {
  BottomSheet,
  Button,
  Card,
  Chip,
  IconButton,
  Input,
  StatusBadge,
  Text,
} from '@/components';
import { darkPalette, lightPalette, statusLight, ThemeProvider, useTheme } from '@/theme';

jest.mock('react-native/Libraries/Utilities/useColorScheme');
const mockUseColorScheme = jest.mocked(useColorScheme);

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

function renderWithTheme(ui: ReactElement) {
  return render(
    <SafeAreaProvider initialMetrics={metrics}>
      <ThemeProvider>{ui}</ThemeProvider>
    </SafeAreaProvider>,
  );
}

beforeEach(() => {
  mockUseColorScheme.mockReturnValue('light');
});

describe('useTheme', () => {
  function ThemeProbe() {
    const theme = useTheme();
    return <RNText>{`${theme.scheme}:${theme.colors.surface}`}</RNText>;
  }

  it('follows the system colour scheme', () => {
    mockUseColorScheme.mockReturnValue('dark');
    renderWithTheme(<ThemeProbe />);
    expect(screen.getByText(`dark:${darkPalette.surface}`)).toBeOnTheScreen();
  });

  it('falls back to light when the system reports no preference', () => {
    mockUseColorScheme.mockReturnValue('unspecified');
    renderWithTheme(<ThemeProbe />);
    expect(screen.getByText(`light:${lightPalette.surface}`)).toBeOnTheScreen();
  });

  it('honours an explicit scheme override', () => {
    mockUseColorScheme.mockReturnValue('light');
    render(
      <ThemeProvider scheme="dark">
        <ThemeProbe />
      </ThemeProvider>,
    );
    expect(screen.getByText(`dark:${darkPalette.surface}`)).toBeOnTheScreen();
  });

  it('throws outside a provider rather than silently using defaults', () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<ThemeProbe />)).toThrow(/ThemeProvider/);
    jest.restoreAllMocks();
  });
});

describe('Text', () => {
  it('applies the variant and colour tokens', () => {
    renderWithTheme(
      <Text color="primary" variant="headlineMd">
        Heading
      </Text>,
    );
    expect(screen.getByText('Heading')).toHaveStyle({
      color: lightPalette.primary,
      fontSize: 22,
      fontFamily: 'Inter_600SemiBold',
    });
  });
});

describe('Button', () => {
  it('exposes a button role and fires onPress', async () => {
    const onPress = jest.fn();
    renderWithTheme(<Button label="Save" onPress={onPress} />);

    const button = screen.getByRole('button', { name: 'Save' });
    await userEvent.press(button);

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('reports the disabled state and does not fire', async () => {
    const onPress = jest.fn();
    renderWithTheme(<Button disabled label="Save" onPress={onPress} />);

    const button = screen.getByRole('button', { name: 'Save' });
    expect(button).toBeDisabled();

    await userEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('reports busy while loading and does not fire', async () => {
    const onPress = jest.fn();
    renderWithTheme(<Button label="Save" loading onPress={onPress} />);

    const button = screen.getByRole('button', { name: 'Save' });
    expect(button).toBeBusy();
    expect(button).toBeDisabled();

    await userEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });
});

describe('IconButton', () => {
  it('requires a label so an icon-only control is reachable', () => {
    renderWithTheme(
      <IconButton accessibilityLabel="Close" icon={<RNText>x</RNText>} onPress={jest.fn()} />,
    );
    expect(screen.getByRole('button', { name: 'Close' })).toBeOnTheScreen();
  });

  it('meets the platform minimum touch target', () => {
    renderWithTheme(
      <IconButton
        accessibilityLabel="Close"
        icon={<RNText>x</RNText>}
        onPress={jest.fn()}
        testID="icon-button"
      />,
    );
    // jest-expo resolves Platform.select to iOS, so 44pt applies here.
    expect(screen.getByTestId('icon-button')).toHaveStyle({ height: 44, width: 44 });
  });
});

describe('Chip', () => {
  it('reports its selected state to assistive tech', () => {
    renderWithTheme(<Chip label="Passports" onPress={jest.fn()} selected />);
    expect(screen.getByRole('button', { name: /Passports/ })).toBeSelected();
  });

  it('renders an optional count', () => {
    renderWithTheme(<Chip count={12} label="All" onPress={jest.fn()} />);
    expect(screen.getByText('12')).toBeOnTheScreen();
  });
});

describe('StatusBadge', () => {
  it.each([
    ['safe' as const, 'Safe'],
    ['soon' as const, 'Expiring soon'],
    ['expired' as const, 'Expired'],
  ])('maps %s to its token and always renders a text label', (status, label) => {
    renderWithTheme(<StatusBadge label={label} status={status} testID="badge" />);

    expect(screen.getByText(label)).toHaveStyle({ color: statusLight[status].foreground });
    expect(screen.getByTestId('badge')).toHaveStyle({
      backgroundColor: statusLight[status].container,
    });
  });
});

describe('Card', () => {
  it('is a plain container without onPress', () => {
    renderWithTheme(
      <Card testID="card">
        <RNText>Body</RNText>
      </Card>,
    );
    expect(screen.queryByRole('button')).not.toBeOnTheScreen();
  });

  it('becomes a button when pressable', async () => {
    const onPress = jest.fn();
    renderWithTheme(
      <Card accessibilityLabel="Open document" onPress={onPress}>
        <RNText>Body</RNText>
      </Card>,
    );

    await userEvent.press(screen.getByRole('button', { name: 'Open document' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe('Input', () => {
  it('links its label to the field for screen readers', () => {
    renderWithTheme(<Input label="Document name" />);
    expect(screen.getByLabelText('Document name')).toBeOnTheScreen();
  });

  it('marks required fields in the accessible name', () => {
    renderWithTheme(<Input label="Passport number" required />);
    expect(screen.getByLabelText('Passport number, required')).toBeOnTheScreen();
  });

  it('shows the error message and colours the border with the error token', () => {
    renderWithTheme(<Input error="Enter a future date" label="Expiry" testID="field" />);

    expect(screen.getByText('Enter a future date')).toBeOnTheScreen();
    expect(screen.getByTestId('field')).toHaveStyle({ borderColor: lightPalette.error });
  });

  it('prefers the error over the helper text', () => {
    renderWithTheme(<Input error="Required" helperText="Optional hint" label="Expiry" />);

    expect(screen.getByText('Required')).toBeOnTheScreen();
    expect(screen.queryByText('Optional hint')).not.toBeOnTheScreen();
  });
});

describe('BottomSheet', () => {
  it('renders its title and content when visible', () => {
    renderWithTheme(
      <BottomSheet onClose={jest.fn()} title="Filters" visible>
        <RNText>Sheet body</RNText>
      </BottomSheet>,
    );

    expect(screen.getByText('Filters')).toBeOnTheScreen();
    expect(screen.getByText('Sheet body')).toBeOnTheScreen();
  });

  it('hides its content when not visible', () => {
    renderWithTheme(
      <BottomSheet onClose={jest.fn()} title="Filters" visible={false}>
        <RNText>Sheet body</RNText>
      </BottomSheet>,
    );

    expect(screen.queryByText('Sheet body')).not.toBeOnTheScreen();
  });

  it('closes when the scrim is pressed', async () => {
    const onClose = jest.fn();
    renderWithTheme(
      <BottomSheet onClose={onClose} testID="sheet" title="Filters" visible>
        <RNText>Sheet body</RNText>
      </BottomSheet>,
    );

    // The scrim is deliberately outside the accessibility tree, so it has to be
    // queried explicitly — that exclusion is the behaviour under test.
    const scrim = screen.getByTestId('sheet-scrim', { includeHiddenElements: true });
    await userEvent.press(scrim);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('keeps the sheet itself in the accessibility tree as a modal', () => {
    renderWithTheme(
      <BottomSheet onClose={jest.fn()} testID="sheet" title="Filters" visible>
        <RNText>Sheet body</RNText>
      </BottomSheet>,
    );

    expect(screen.getByRole('header', { name: 'Filters' })).toBeOnTheScreen();
  });
});
