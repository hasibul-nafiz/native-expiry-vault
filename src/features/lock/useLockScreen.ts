import { useCallback, useEffect, useState } from 'react';

import {
  biometricPort,
  UNAVAILABLE,
  type BiometricCapability,
  type BiometricPort,
} from '@/services/biometrics';

import {
  isLockedOut,
  NO_FAILURES,
  registerFailure,
  remainingLockoutMs,
  type AttemptState,
} from './backoff';
import { lockStorage, type LockStoragePort } from './lockStorage';
import { PIN_LENGTH, verifyPin } from './pin';
import { setAuthenticating, setLockEnrolled, unlockVault } from './useLockState';

/**
 * Drives the lock screen: entry, verification, backoff and the biometric path.
 *
 * Both ports are injected so the whole flow — including a wrong PIN escalating
 * into a timeout — is exercised in Jest against fakes, with no Keychain and no
 * biometric hardware.
 */

export type LockScreenError = 'wrong-pin' | 'biometric-failed' | null;

export interface UseLockScreenOptions {
  storage?: LockStoragePort;
  biometrics?: BiometricPort;
}

export interface LockScreenModel {
  entry: string;
  capability: BiometricCapability;
  attempts: AttemptState;
  error: LockScreenError;
  /** Milliseconds left on the current timeout, or 0. */
  lockoutMs: number;
  lockedOut: boolean;
  /** A PBKDF2 derivation or a biometric prompt is in flight. */
  busy: boolean;
  pressDigit: (digit: string) => void;
  pressBackspace: () => void;
  promptBiometric: () => void;
}

export function useLockScreen({
  storage = lockStorage,
  biometrics = biometricPort,
}: UseLockScreenOptions = {}): LockScreenModel {
  const [entry, setEntry] = useState('');
  const [attempts, setAttempts] = useState<AttemptState>(NO_FAILURES);
  const [capability, setCapability] = useState<BiometricCapability>(UNAVAILABLE);
  const [error, setError] = useState<LockScreenError>(null);
  const [verifying, setVerifying] = useState(false);
  const [prompting, setPrompting] = useState(false);
  const [tick, setTick] = useState(() => Date.now());

  const lockoutMs = remainingLockoutMs(attempts, tick);
  const lockedOut = lockoutMs > 0;
  const busy = verifying || prompting;

  const authenticate = useCallback(
    async (hardware: BiometricCapability) => {
      setPrompting(true);
      // Tells the auto-lock listener to ignore the backgrounding the OS's own
      // prompt causes; without it, authenticating re-locks the vault.
      setAuthenticating(true);

      try {
        const outcome = await biometrics.authenticate({
          promptMessage: 'Unlock ExpiryVault',
          cancelLabel: 'Use PIN',
        });

        if (outcome.status === 'success') {
          await storage.writeAttempts(NO_FAILURES);
          setAttempts(NO_FAILURES);
          unlockVault();

          return;
        }

        if (outcome.status === 'failed') {
          // Deliberately not a PIN failure. The sensor runs its own lockout,
          // and a face the camera cannot read is not evidence of an attacker
          // guessing the PIN.
          setError('biometric-failed');
        }

        if (outcome.status === 'unavailable') {
          // The OS has withdrawn biometrics for now. Stop offering them.
          setCapability({ ...hardware, enrolled: false });
        }
      } finally {
        setAuthenticating(false);
        setPrompting(false);
      }
    },
    [biometrics, storage],
  );

  // Load the persisted backoff and the hardware, then offer the prompt once.
  // The auto-prompt is chained off the load rather than run from its own effect
  // so it fires exactly once and needs no synchronous setState.
  useEffect(() => {
    let active = true;

    void (async () => {
      const [hardware, stored] = await Promise.all([
        biometrics.getCapability(),
        storage.readAttempts(),
      ]);

      if (!active) {
        return;
      }

      setCapability(hardware);
      setAttempts(stored);
      setTick(Date.now());

      if (hardware.enrolled && !isLockedOut(stored, Date.now())) {
        await authenticate(hardware);
      }
    })();

    return () => {
      active = false;
    };
  }, [authenticate, biometrics, storage]);

  // Only ticks while a timeout is actually running.
  useEffect(() => {
    if (!lockedOut) {
      return;
    }

    const id = setInterval(() => {
      setTick(Date.now());
    }, 1000);

    return () => {
      clearInterval(id);
    };
  }, [lockedOut]);

  const submit = useCallback(
    async (pin: string) => {
      setVerifying(true);

      try {
        const record = await storage.readPinRecord();

        if (record === null) {
          // The PIN was removed while the gate was up. Nothing can verify the
          // user, so holding them here would strand them behind a dead lock.
          setLockEnrolled(false);
          unlockVault();

          return;
        }

        if (verifyPin(pin, record)) {
          await storage.writeAttempts(NO_FAILURES);
          setAttempts(NO_FAILURES);
          setEntry('');
          unlockVault();

          return;
        }

        const next = registerFailure(attempts, Date.now());
        await storage.writeAttempts(next);

        setAttempts(next);
        setTick(Date.now());
        setEntry('');
        setError('wrong-pin');
      } finally {
        setVerifying(false);
      }
    },
    [attempts, storage],
  );

  const pressDigit = useCallback(
    (digit: string) => {
      if (lockedOut || busy || entry.length >= PIN_LENGTH) {
        return;
      }

      const next = entry + digit;

      setError(null);
      setEntry(next);

      if (next.length === PIN_LENGTH) {
        void submit(next);
      }
    },
    [busy, entry, lockedOut, submit],
  );

  const pressBackspace = useCallback(() => {
    if (lockedOut || busy) {
      return;
    }

    setError(null);
    setEntry((current) => current.slice(0, -1));
  }, [busy, lockedOut]);

  const promptBiometric = useCallback(() => {
    if (lockedOut || busy || !capability.enrolled) {
      return;
    }

    void authenticate(capability);
  }, [authenticate, busy, capability, lockedOut]);

  return {
    entry,
    capability,
    attempts,
    error,
    lockoutMs,
    lockedOut,
    busy,
    pressDigit,
    pressBackspace,
    promptBiometric,
  };
}
