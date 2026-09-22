import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { ThemeProvider } from '@/theme';

import { FREE_ATTEMPTS, LOCKOUT_SCHEDULE_MS } from '../backoff';
import { LockScreen } from '../LockScreen';
import { getLockState, initialiseLock, resetLockStore } from '../useLockState';
import {
  FACE_ID,
  fakeBiometrics,
  fakeLockStorage,
  NO_BIOMETRICS,
  type FakeBiometrics,
  type FakeLockStorage,
} from './fixtures/fakes';

const PIN = '284091';
const WRONG = '111112';

async function mount(
  storage: FakeLockStorage,
  biometrics: FakeBiometrics = fakeBiometrics(NO_BIOMETRICS),
) {
  await act(async () => {
    await initialiseLock(storage);
  });

  const view = render(
    <ThemeProvider>
      <LockScreen biometrics={biometrics} storage={storage} />
    </ThemeProvider>,
  );

  // The mount effect loads the hardware and the persisted attempts.
  await act(async () => {});

  return view;
}

async function type(pin: string): Promise<void> {
  for (const digit of pin) {
    fireEvent.press(screen.getByTestId(`keypad-${digit}`));
    // Verification is a PBKDF2 derivation, so the last digit resolves async.
    await act(async () => {});
  }
}

afterEach(() => {
  resetLockStore();
});

describe('PIN entry', () => {
  it('fills a dot per digit without submitting early', async () => {
    await mount(fakeLockStorage(PIN));

    await type('2840');

    expect(screen.getAllByTestId('pin-dot-filled')).toHaveLength(4);
    expect(screen.getAllByTestId('pin-dot-empty')).toHaveLength(2);
    expect(getLockState().status).toBe('locked');
  });

  it('removes the last digit on backspace', async () => {
    await mount(fakeLockStorage(PIN));

    await type('284');
    fireEvent.press(screen.getByTestId('keypad-backspace'));

    expect(screen.getAllByTestId('pin-dot-filled')).toHaveLength(2);
  });

  it('unlocks on the correct PIN', async () => {
    await mount(fakeLockStorage(PIN));

    await type(PIN);

    await waitFor(() => {
      expect(getLockState().status).toBe('unlocked');
    });
  });

  it('clears the entry and says so on a wrong PIN', async () => {
    await mount(fakeLockStorage(PIN));

    await type(WRONG);

    expect(getLockState().status).toBe('locked');
    expect(screen.getAllByTestId('pin-dot-empty')).toHaveLength(6);
    expect(screen.getByText('Incorrect PIN.')).toBeTruthy();
  });

  it('unlocks rather than stranding the user if the PIN vanished', async () => {
    const storage = fakeLockStorage(PIN);
    await mount(storage);

    // Removed from another surface while the gate was up.
    await storage.deletePin();
    await type(PIN);

    await waitFor(() => {
      expect(getLockState().status).toBe('unlocked');
    });
  });
});

describe('backoff', () => {
  it('persists each failure, so a force-quit does not reset the count', async () => {
    const storage = fakeLockStorage(PIN);
    await mount(storage);

    await type(WRONG);
    await type(WRONG);

    expect(storage.attempts.failures).toBe(2);
  });

  it('warns once the attempts are nearly spent', async () => {
    const storage = fakeLockStorage(PIN);
    await mount(storage);

    for (let attempt = 0; attempt < FREE_ATTEMPTS - 1; attempt += 1) {
      await type(WRONG);
    }

    expect(screen.getByText('Incorrect PIN. 1 attempt left before a timeout.')).toBeTruthy();
  });

  it('imposes a timeout and disables the keypad once they are', async () => {
    const storage = fakeLockStorage(PIN);
    await mount(storage);

    for (let attempt = 0; attempt <= FREE_ATTEMPTS; attempt += 1) {
      await type(WRONG);
    }

    expect(screen.getByText('Too many attempts. Try again in 30 seconds.')).toBeTruthy();
    expect(screen.getByTestId('keypad-1')).toBeDisabled();

    // And the keypad genuinely stops accepting input, not just visually.
    await type('2');
    expect(screen.getAllByTestId('pin-dot-empty')).toHaveLength(6);
  });

  it('clears the count on a successful unlock', async () => {
    const storage = fakeLockStorage(PIN);
    await mount(storage);

    await type(WRONG);
    await type(PIN);

    await waitFor(() => {
      expect(storage.attempts.failures).toBe(0);
    });
  });

  it('starts locked out when a timeout was still running at launch', async () => {
    const storage = fakeLockStorage(PIN);
    storage.attempts = {
      failures: FREE_ATTEMPTS + 1,
      lockedUntil: Date.now() + LOCKOUT_SCHEDULE_MS[0],
      lockoutMs: LOCKOUT_SCHEDULE_MS[0],
    };

    await mount(storage);

    expect(screen.getByTestId('keypad-1')).toBeDisabled();
  });
});

describe('biometrics', () => {
  it('offers nothing when the device has no enrolled biometrics', async () => {
    const biometrics = fakeBiometrics(NO_BIOMETRICS);
    await mount(fakeLockStorage(PIN), biometrics);

    expect(screen.queryByTestId('biometric-button')).toBeNull();
    expect(screen.queryByTestId('keypad-action')).toBeNull();
    expect(biometrics.calls).toBe(0);
  });

  it('prompts once on mount and unlocks on success', async () => {
    const biometrics = fakeBiometrics(FACE_ID, [{ status: 'success' }]);
    await mount(fakeLockStorage(PIN), biometrics);

    await waitFor(() => {
      expect(getLockState().status).toBe('unlocked');
    });
    expect(biometrics.calls).toBe(1);
  });

  it('names the hardware rather than assuming Face ID', async () => {
    const biometrics = fakeBiometrics(
      { available: true, enrolled: true, kind: 'fingerprint' },
      [{ status: 'cancelled' }],
    );
    await mount(fakeLockStorage(PIN), biometrics);

    expect(screen.getByText('Unlock with your fingerprint')).toBeTruthy();
  });

  it('falls back to the PIN when the prompt is cancelled', async () => {
    const biometrics = fakeBiometrics(FACE_ID, [{ status: 'cancelled' }]);
    await mount(fakeLockStorage(PIN), biometrics);

    expect(getLockState().status).toBe('locked');
    expect(screen.getByTestId('keypad-1')).not.toBeDisabled();
  });

  it('retries from the button', async () => {
    const biometrics = fakeBiometrics(FACE_ID, [{ status: 'cancelled' }, { status: 'success' }]);
    await mount(fakeLockStorage(PIN), biometrics);

    await act(async () => {
      fireEvent.press(screen.getByTestId('biometric-button'));
    });

    expect(biometrics.calls).toBe(2);
    await waitFor(() => {
      expect(getLockState().status).toBe('unlocked');
    });
  });

  it('does not spend a PIN attempt on an unrecognised face', async () => {
    const storage = fakeLockStorage(PIN);
    const biometrics = fakeBiometrics(FACE_ID, [{ status: 'failed' }]);
    await mount(storage, biometrics);

    // The sensor runs its own lockout; a face the camera misread is not
    // evidence of someone guessing the PIN.
    expect(storage.attempts.failures).toBe(0);
    expect(screen.getByText('Face ID was not recognised. Enter your PIN.')).toBeTruthy();
  });

  it('stops offering biometrics once the OS withdraws them', async () => {
    const biometrics = fakeBiometrics(FACE_ID, [{ status: 'unavailable' }]);
    await mount(fakeLockStorage(PIN), biometrics);

    expect(screen.queryByTestId('biometric-button')).toBeNull();
  });

  it('does not prompt while a timeout is running', async () => {
    const storage = fakeLockStorage(PIN);
    storage.attempts = {
      failures: FREE_ATTEMPTS + 1,
      lockedUntil: Date.now() + LOCKOUT_SCHEDULE_MS[0],
      lockoutMs: LOCKOUT_SCHEDULE_MS[0],
    };
    const biometrics = fakeBiometrics(FACE_ID, [{ status: 'success' }]);

    await mount(storage, biometrics);

    // Otherwise biometrics are a way straight past the backoff.
    expect(biometrics.calls).toBe(0);
    expect(getLockState().status).toBe('locked');
  });
});

describe('accessibility', () => {
  it('labels every key by name', async () => {
    await mount(fakeLockStorage(PIN));

    expect(screen.getByLabelText('Digit 7')).toBeTruthy();
    expect(screen.getByLabelText('Digit 0')).toBeTruthy();
    expect(screen.getByLabelText('Delete last digit')).toBeTruthy();
  });

  it('reads the dots as one element with a count', async () => {
    await mount(fakeLockStorage(PIN));

    await type('284');

    expect(screen.getByLabelText('Master PIN, 3 of 6 digits entered')).toBeTruthy();
  });
});
