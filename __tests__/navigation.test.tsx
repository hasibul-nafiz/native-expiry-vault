import { renderRouter, screen } from 'expo-router/testing-library';

import { lockVault, unlockVault } from '@/features/lock/useLockState';

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

afterEach(() => {
  // The lock store is module-level, so it outlives a single render.
  unlockVault();
});

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
  it('renders the app when unlocked', async () => {
    renderApp('/');

    expect(await screen.findByTestId('notifications-button')).toBeOnTheScreen();
    expect(screen.queryByText('Locked')).not.toBeOnTheScreen();
  });

  it('redirects to the gate when locked', async () => {
    lockVault();
    const router = renderApp('/');

    expect(await screen.findByText('Locked')).toBeOnTheScreen();
    expect(router.getPathname()).toBe('/lock');
  });

  it('sends a deep link into a locked app to the gate, not the target', async () => {
    lockVault();
    const router = renderApp('/item/abc123');

    expect(await screen.findByText('Locked')).toBeOnTheScreen();
    expect(screen.queryByText('Item detail')).not.toBeOnTheScreen();
    expect(router.getPathname()).toBe('/lock');
  });
});
