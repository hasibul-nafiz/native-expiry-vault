import { act, render, screen } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';

import { PrivacyShield } from '@/components/PrivacyShield';
import { fakeLockStorage } from '@/features/lock/__tests__/fixtures/fakes';
import { initialiseLock, resetLockStore } from '@/features/lock/useLockState';
import type { ScreenCapturePort } from '@/services/screenCapture';
import { ThemeProvider } from '@/theme';

/**
 * The app-switcher cover.
 *
 * What is testable in Jest is the policy: when the overlay is up, and when
 * FLAG_SECURE is asked for. Whether iOS actually captures the covered frame is
 * the part only a device can answer, and is logged as such.
 */

let emit: (status: AppStateStatus) => void;

function fakeCapturePort(): ScreenCapturePort & { prevented: number; allowed: number } {
  const port = {
    prevented: 0,
    allowed: 0,
    prevent: async () => {
      port.prevented += 1;
    },
    allow: async () => {
      port.allowed += 1;
    },
  };

  return port;
}

beforeEach(() => {
  jest.spyOn(AppState, 'addEventListener').mockImplementation((event, handler) => {
    if (event === 'change') {
      emit = handler as (status: AppStateStatus) => void;
    }

    return { remove: jest.fn() };
  });
});

afterEach(() => {
  jest.restoreAllMocks();
  resetLockStore();
});

async function mount(pin: string | null, capturePort = fakeCapturePort()) {
  await act(async () => {
    await initialiseLock(fakeLockStorage(pin));
  });

  render(
    <ThemeProvider>
      <PrivacyShield capturePort={capturePort} />
    </ThemeProvider>,
  );

  await act(async () => {});

  return capturePort;
}

function send(status: AppStateStatus): void {
  act(() => {
    emit(status);
  });
}

/**
 * `includeHiddenElements` is required, and is itself the assertion that the
 * shield is outside the accessibility tree: the default query cannot see it
 * precisely because it sets `accessibilityElementsHidden`.
 */
function shield() {
  return screen.queryByTestId('privacy-shield', { includeHiddenElements: true });
}

describe('with a PIN enrolled', () => {
  it('fails closed before the app state is known', async () => {
    await mount('284091');

    // `AppState.currentState` is undefined under Jest and null on iOS at
    // launch. Covering is the safe reading of "I do not know yet".
    expect(shield()).toBeTruthy();
  });

  it('stays down while the app is in the foreground', async () => {
    await mount('284091');

    send('active');

    expect(shield()).toBeNull();
  });

  it('covers the content the moment the app goes inactive', async () => {
    await mount('284091');

    // `inactive`, not `background`: that is when iOS takes the snapshot.
    send('inactive');

    expect(shield()).toBeTruthy();
  });

  it('covers the content in the background too', async () => {
    await mount('284091');

    send('background');

    expect(shield()).toBeTruthy();
  });

  it('lifts again on return to the foreground', async () => {
    await mount('284091');

    send('active');
    send('background');
    send('active');

    expect(shield()).toBeNull();
  });

  it('asks for FLAG_SECURE', async () => {
    const capturePort = await mount('284091');

    expect(capturePort.prevented).toBe(1);
    expect(capturePort.allowed).toBe(0);
  });

  it('stays out of the accessibility tree', async () => {
    await mount('284091');

    send('inactive');

    // It exists for whoever is looking over the user's shoulder; a screen
    // reader is never reading an app-switcher snapshot. The default query,
    // which respects accessibility visibility, must therefore miss it.
    expect(screen.queryByTestId('privacy-shield')).toBeNull();
    expect(shield()).toBeTruthy();
  });
});

describe('with no PIN enrolled', () => {
  it('never covers anything', async () => {
    await mount(null);

    send('active');
    send('inactive');
    send('background');

    expect(shield()).toBeNull();
  });

  it('does not block Android screenshots', async () => {
    const capturePort = await mount(null);

    // Blocking every screenshot for a user who declined the lock is a cost
    // with no matching benefit.
    expect(capturePort.prevented).toBe(0);
    expect(capturePort.allowed).toBe(1);
  });
});
