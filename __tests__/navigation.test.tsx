import { renderRouter, screen } from 'expo-router/testing-library';

import { lockStorage } from '@/features/lock/lockStorage';
import { initialiseLock, resetLockStore } from '@/features/lock/useLockState';

/**
 * The root layout bootstraps the lock from secure-store on mount, so seeding
 * the store from a test would simply be overwritten. This replaces the storage
 * the bootstrap reads through instead, leaving the real bootstrap, the real
 * gate and the real redirect in the path being tested.
 */
jest.mock('@/features/lock/lockStorage', () => {
  // `jest.mock` factories are hoisted above the imports.
  /* eslint-disable @typescript-eslint/no-require-imports */
  const { NO_FAILURES } = require('@/features/lock/backoff') as typeof import('@/features/lock/backoff');
  const { buildPinRecord } = require('@/features/lock/pin') as typeof import('@/features/lock/pin');
  /* eslint-enable @typescript-eslint/no-require-imports */

  let record: ReturnType<typeof buildPinRecord> | null = null;
  let attempts = NO_FAILURES;

  return {
    lockStorage: {
      readPinRecord: async () => record,
      // One iteration: these tests are about routing, not key stretching.
      writePin: async (pin: string) => {
        record = buildPinRecord(pin, 'navigation-salt', 1);
      },
      deletePin: async () => {
        record = null;
        attempts = NO_FAILURES;
      },
      readAttempts: async () => attempts,
      writeAttempts: async (next: typeof NO_FAILURES) => {
        attempts = next;
      },
    },
  };
});

/**
 * Route-level tests for the F3 shell.
 *
 * These live at the repo root rather than under `app/` because expo-router's
 * `require.context` registers every file below `app/` as a real route — a test
 * colocated there would become a navigable screen.
 *
 * `renderRouter` mounts the actual `app/` directory, so these exercise the real
 * route tree, groups and layouts. What they cannot cover is the native tab bar
 * and the native modal sheet, which have no JS representation; those need a
 * device.
 */

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

function renderApp(initialUrl: string) {
  return renderRouter('app', { initialUrl, ...metrics });
}

afterEach(async () => {
  // The lock store is module-level, so it outlives a single render.
  await lockStorage.deletePin();
  resetLockStore();
});

/**
 * Puts a PIN on the vault, which is what makes the gate able to come up at all
 * — F9 made locking a no-op when nothing is enrolled.
 */
async function enrolAndLock(): Promise<void> {
  await lockStorage.writePin('284091');
  await initialiseLock();
}

describe('tab routes', () => {
  it.each([
    // F8 turned the Scan tab from a placeholder into a launcher for the
    // full-screen camera route, so its heading is the invitation, not the word.
    ['/scan', 'Scan a document'],
    ['/timeline', 'Timeline'],
    ['/profile', 'Profile'],
    ['/settings', 'Settings'],
  ])('renders %s as the %s screen', async (url, title) => {
    renderApp(url);

    expect(await screen.findByText(title)).toBeOnTheScreen();
  });

  it('renders the dashboard at /', async () => {
    renderApp('/');

    // The dashboard's header is present in every one of its states, so this
    // holds whether or not a database is available.
    expect(await screen.findByTestId('notifications-button')).toBeOnTheScreen();
  });

  it('keeps route groups out of the pathname', () => {
    const router = renderApp('/');

    // Not '/(app)/(tabs)/' — the parentheses groups are organisational only.
    expect(router.getPathname()).toBe('/');
  });

  it.each([
    ['/scan', '/scan'],
    ['/settings', '/settings'],
  ])('resolves %s to a clean pathname', (url, expected) => {
    const router = renderApp(url);

    expect(router.getPathname()).toBe(expected);
  });
});

describe('when the database is unavailable', () => {
  /**
   * `renderRouter` mounts the real root layout, whose DatabaseProvider tries to
   * open SQLCipher — which cannot work under Jest. That is the same path a user
   * hits when the keychain entry is corrupted, so the shell must stay navigable
   * rather than crash.
   */
  it('still renders the dashboard chrome', async () => {
    renderApp('/');

    expect(await screen.findByTestId('notifications-button')).toBeOnTheScreen();
  });

  it('leaves the other tabs entirely unaffected', async () => {
    renderApp('/settings');

    expect(await screen.findByText('Settings')).toBeOnTheScreen();
  });
});

describe('stack routes', () => {
  it('renders the pushed item detail', async () => {
    renderApp('/item/abc123');

    // Under renderRouter there is no database, so the screen reports the error
    // state — what matters here is that the route resolved and mounted.
    expect(await screen.findByTestId('detail-back')).toBeOnTheScreen();
  });

  it('renders the nested edit route', async () => {
    const router = renderApp('/item/abc123/edit');

    expect(router.getPathname()).toBe('/item/abc123/edit');
  });

  it('passes the id through as a route param', () => {
    const router = renderApp('/item/abc123');

    expect(router.getSearchParams()).toMatchObject({ id: 'abc123' });
  });

  it('renders the modal add route', async () => {
    renderApp('/add');

    // The wizard's step indicator, which is present in every one of its states.
    expect(await screen.findByTestId('step-progress')).toBeOnTheScreen();
  });
});

describe('unmatched routes', () => {
  it('falls through to +not-found instead of throwing', async () => {
    renderApp('/no-such-screen');

    expect(await screen.findByText('This screen does not exist')).toBeOnTheScreen();
  });
});

describe('the lock gate', () => {
  it('renders the app when no PIN is enrolled', async () => {
    renderApp('/');

    expect(await screen.findByTestId('notifications-button')).toBeOnTheScreen();
    expect(screen.queryByText('Welcome back')).not.toBeOnTheScreen();
  });

  it('redirects to the gate when locked', async () => {
    await enrolAndLock();
    const router = renderApp('/');

    expect(await screen.findByText('Welcome back')).toBeOnTheScreen();
    expect(router.getPathname()).toBe('/lock');
  });

  it('sends a deep link into a locked app to the gate, not the target', async () => {
    await enrolAndLock();
    const router = renderApp('/item/abc123');

    expect(await screen.findByText('Welcome back')).toBeOnTheScreen();
    expect(screen.queryByText('Item detail')).not.toBeOnTheScreen();
    expect(router.getPathname()).toBe('/lock');
  });

  it('keeps the dev routes behind the gate', async () => {
    // F3 logged that these sat outside both groups and so were reachable
    // without unlocking. F9 moved them inside `(app)`.
    await enrolAndLock();
    const router = renderApp('/dev-gallery');

    expect(await screen.findByText('Welcome back')).toBeOnTheScreen();
    expect(router.getPathname()).toBe('/lock');
  });
});
