import { render, screen, userEvent } from '@testing-library/react-native';
import type { ErrorBoundaryProps } from 'expo-router';
import { Component, type ReactNode } from 'react';
import { Text as RNText } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppErrorBoundary } from '@/components';

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

/**
 * expo-router's own boundary cannot be exercised from a unit test, so this
 * stands in for it: a minimal class boundary that renders the same component
 * with the same props expo-router passes.
 */
class TestBoundary extends Component<
  { children: ReactNode; retry: () => Promise<void> },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error === null) {
      return this.props.children;
    }

    const props: ErrorBoundaryProps = { error: this.state.error, retry: this.props.retry };

    return <AppErrorBoundary {...props} />;
  }
}

function Exploding(): ReactNode {
  throw new Error('Passport 1234567 could not be read');
}

function renderBoundary(child: ReactNode, retry = jest.fn(async () => {})) {
  render(
    <SafeAreaProvider initialMetrics={metrics}>
      <TestBoundary retry={retry}>{child}</TestBoundary>
    </SafeAreaProvider>,
  );

  return retry;
}

beforeEach(() => {
  // React logs the caught error itself; the test asserts on the boundary, not
  // on the console noise.
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('AppErrorBoundary', () => {
  it('leaves a healthy tree untouched', () => {
    renderBoundary(<RNText>All good</RNText>);

    expect(screen.getByText('All good')).toBeOnTheScreen();
    expect(screen.queryByTestId('app-error-boundary')).toBeNull();
  });

  it('replaces a render-phase throw with a recovery screen', () => {
    renderBoundary(<Exploding />);

    expect(screen.getByTestId('app-error-boundary')).toBeOnTheScreen();
    expect(screen.getByText('Something went wrong')).toBeOnTheScreen();
    expect(screen.getByText('Your data has not been changed.')).toBeOnTheScreen();
  });

  /**
   * The message can name a document. It is never rendered, for the same reason
   * the app does not log it.
   */
  it('never renders the error message', () => {
    renderBoundary(<Exploding />);

    expect(screen.queryByText(/Passport 1234567/)).toBeNull();
  });

  it('announces the title as a heading', () => {
    renderBoundary(<Exploding />);

    expect(screen.getByRole('header', { name: 'Something went wrong' })).toBeOnTheScreen();
  });

  it('calls retry from the action', async () => {
    const retry = renderBoundary(<Exploding />);

    await userEvent.press(screen.getByTestId('app-error-retry'));

    expect(retry).toHaveBeenCalledTimes(1);
  });

  /**
   * At the root there is no ThemeProvider left above the boundary, so it has to
   * supply its own or the error screen throws while rendering the error.
   */
  it('renders without a ThemeProvider above it', () => {
    expect(() => {
      renderBoundary(<Exploding />);
    }).not.toThrow();
  });
});
