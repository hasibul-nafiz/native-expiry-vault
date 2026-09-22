import { render, waitFor } from '@testing-library/react-native';

import { useNotificationDeepLink } from '../useNotificationDeepLink';

/**
 * Tapping a reminder has to land on the document it is about. The route is
 * carried in the notification payload, so this covers both ways it arrives:
 * waiting at a cold start, and delivered while the app is already running.
 */

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

interface HarnessProps {
  getInitial?: () => string | null;
  subscribe?: (handler: (deepLink: string) => void) => () => void;
}

function Harness({ getInitial, subscribe }: HarnessProps) {
  useNotificationDeepLink({ getInitial, subscribe });

  return null;
}

beforeEach(() => {
  mockPush.mockClear();
});

describe('useNotificationDeepLink', () => {
  it('follows a notification tapped before the app was running', () => {
    render(<Harness getInitial={() => '/item/abc'} subscribe={() => () => undefined} />);

    expect(mockPush).toHaveBeenCalledWith('/item/abc');
  });

  it('navigates nowhere when the app was not opened from a notification', () => {
    render(<Harness getInitial={() => null} subscribe={() => () => undefined} />);

    expect(mockPush).not.toHaveBeenCalled();
  });

  it('follows a notification tapped while the app is open', async () => {
    const delivered: ((deepLink: string) => void)[] = [];

    render(
      <Harness
        getInitial={() => null}
        subscribe={(handler) => {
          delivered.push(handler);

          return () => undefined;
        }}
      />,
    );

    await waitFor(() => {
      expect(delivered).toHaveLength(1);
    });
    delivered[0]('/item/xyz');

    expect(mockPush).toHaveBeenCalledWith('/item/xyz');
  });

  it('routes a digest to the vault', () => {
    render(<Harness getInitial={() => '/'} subscribe={() => () => undefined} />);

    expect(mockPush).toHaveBeenCalledWith('/');
  });

  /**
   * The lock gate unmounts the whole runtime, so while the vault is locked
   * nothing consumes the response — and the OS keeps holding it. Unlocking
   * remounts this hook, which then follows it.
   *
   * This is why a tapped reminder is not lost behind the lock, and it is worth
   * pinning down: it depends on `consumeInitialDeepLink` clearing the response
   * only once it has actually been used.
   */
  it('follows a notification that arrived while the vault was locked', () => {
    let pending: string | null = '/item/locked';
    const getInitial = () => {
      const value = pending;
      pending = null;

      return value;
    };

    // Locked: the runtime is not mounted, so nothing reads the response.
    expect(mockPush).not.toHaveBeenCalled();

    // Unlocked: the runtime mounts and the waiting response is followed.
    render(<Harness getInitial={getInitial} subscribe={() => () => undefined} />);

    expect(mockPush).toHaveBeenCalledWith('/item/locked');
  });

  it('follows it only once, not again on the next remount', () => {
    let pending: string | null = '/item/locked';
    const getInitial = () => {
      const value = pending;
      pending = null;

      return value;
    };

    render(<Harness getInitial={getInitial} subscribe={() => () => undefined} />).unmount();
    render(<Harness getInitial={getInitial} subscribe={() => () => undefined} />);

    expect(mockPush).toHaveBeenCalledTimes(1);
  });

  it('unsubscribes when it unmounts', () => {
    const unsubscribe = jest.fn();

    const view = render(<Harness getInitial={() => null} subscribe={() => unsubscribe} />);
    view.unmount();

    expect(unsubscribe).toHaveBeenCalled();
  });
});
