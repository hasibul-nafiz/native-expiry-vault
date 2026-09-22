import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { ThemeProvider } from '@/theme';

import { verifyPin } from '../pin';
import { SetPinScreen } from '../SetPinScreen';
import { getLockState, initialiseLock, resetLockStore } from '../useLockState';
import { fakeLockStorage, type FakeLockStorage } from './fixtures/fakes';

const PIN = '284091';
const NEW_PIN = '730562';

async function mount(storage: FakeLockStorage) {
  await act(async () => {
    await initialiseLock(storage);
  });

  const onDone = jest.fn();

  render(
    <ThemeProvider>
      <SetPinScreen onDone={onDone} storage={storage} />
    </ThemeProvider>,
  );

  return onDone;
}

async function type(pin: string): Promise<void> {
  for (const digit of pin) {
    fireEvent.press(screen.getByTestId(`keypad-${digit}`));
    await act(async () => {});
  }
}

afterEach(() => {
  resetLockStore();
});

describe('enrolling a first PIN', () => {
  it('saves a PIN entered twice', async () => {
    const storage = fakeLockStorage(null);
    const onDone = await mount(storage);

    expect(screen.getByText('Choose a 6-digit PIN')).toBeTruthy();
    await type(NEW_PIN);

    expect(screen.getByText('Enter it again to confirm')).toBeTruthy();
    await type(NEW_PIN);

    await waitFor(() => {
      expect(onDone).toHaveBeenCalled();
    });
    expect(storage.record).not.toBeNull();
    expect(verifyPin(NEW_PIN, storage.record!)).toBe(true);
    expect(getLockState().enrolled).toBe(true);
  });

  it('starts over when the confirmation does not match', async () => {
    const storage = fakeLockStorage(null);
    await mount(storage);

    await type(NEW_PIN);
    await type('730563');

    expect(screen.getByText('Those PINs did not match. Start again.')).toBeTruthy();
    expect(screen.getAllByTestId('pin-dot-empty')).toHaveLength(6);
    expect(storage.record).toBeNull();
  });

  it.each([
    ['111111', 'repeats'],
    ['123456', 'a run'],
  ])('refuses %s (%s)', async (weak) => {
    const storage = fakeLockStorage(null);
    await mount(storage);

    await type(weak);

    expect(
      screen.getByText(
        'That PIN is too easy to guess. Avoid repeats and runs like 111111 or 123456.',
      ),
    ).toBeTruthy();
    // Still on the first stage, not advanced to confirmation.
    expect(screen.queryByText('Enter it again to confirm')).toBeNull();
  });

  it('never stores the PIN in the clear', async () => {
    const storage = fakeLockStorage(null);
    await mount(storage);

    await type(NEW_PIN);
    await type(NEW_PIN);

    await waitFor(() => {
      expect(storage.record).not.toBeNull();
    });
    expect(JSON.stringify(storage.record)).not.toContain(NEW_PIN);
  });
});

describe('changing an existing PIN', () => {
  it('asks for the current PIN first', async () => {
    const storage = fakeLockStorage(PIN);
    await mount(storage);

    expect(screen.getByText('Enter your current PIN')).toBeTruthy();
    expect(screen.queryByTestId('change-pin')).toBeNull();
  });

  it('rejects the wrong current PIN', async () => {
    const storage = fakeLockStorage(PIN);
    await mount(storage);

    await type('111112');

    expect(screen.getByText('Incorrect PIN.')).toBeTruthy();
    expect(screen.queryByTestId('change-pin')).toBeNull();
  });

  it('replaces the PIN once the current one is proven', async () => {
    const storage = fakeLockStorage(PIN);
    const onDone = await mount(storage);

    await type(PIN);
    fireEvent.press(screen.getByTestId('change-pin'));

    await type(NEW_PIN);
    await type(NEW_PIN);

    await waitFor(() => {
      expect(onDone).toHaveBeenCalled();
    });
    expect(verifyPin(NEW_PIN, storage.record!)).toBe(true);
    expect(verifyPin(PIN, storage.record!)).toBe(false);
  });

  it('re-salts on a change, so the same PIN does not reproduce the old hash', async () => {
    const storage = fakeLockStorage(PIN);
    const before = storage.record!;
    await mount(storage);

    await type(PIN);
    fireEvent.press(screen.getByTestId('change-pin'));
    await type(PIN);
    await type(PIN);

    await waitFor(() => {
      expect(storage.record!.salt).not.toBe(before.salt);
    });
    expect(storage.record!.hash).not.toBe(before.hash);
  });
});

describe('turning the lock off', () => {
  it('removes the PIN and unlocks', async () => {
    const storage = fakeLockStorage(PIN);
    const onDone = await mount(storage);

    await type(PIN);
    await act(async () => {
      fireEvent.press(screen.getByTestId('remove-pin'));
    });

    await waitFor(() => {
      expect(onDone).toHaveBeenCalled();
    });
    expect(storage.record).toBeNull();
    expect(getLockState().enrolled).toBe(false);
    // Nothing is left that could re-open the gate, so it must not be up.
    expect(getLockState().status).toBe('unlocked');
  });

  it('discards the failed-attempt count along with the PIN', async () => {
    const storage = fakeLockStorage(PIN);
    storage.attempts = { failures: 4, lockedUntil: null, lockoutMs: 0 };
    await mount(storage);

    await type(PIN);
    await act(async () => {
      fireEvent.press(screen.getByTestId('remove-pin'));
    });

    await waitFor(() => {
      expect(storage.attempts.failures).toBe(0);
    });
  });
});
