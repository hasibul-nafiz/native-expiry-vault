import { useCallback, useState } from 'react';

import { pinProblemKey } from './labels';
import { lockStorage, type LockStoragePort } from './lockStorage';
import { PIN_LENGTH, validatePin, verifyPin } from './pin';
import { setLockEnrolled } from './useLockState';

/**
 * Enrolling, changing and removing the master PIN.
 *
 * The export has no enrolment screen at all, so this flow is designed rather
 * than recreated. Its shape is the conventional one: prove you know the current
 * PIN before you can change or remove it, and confirm a new one twice.
 */

export type SetPinStage =
  /** A PIN exists; prove you know it. */
  | 'current'
  /** Verified; choose what to do. */
  | 'manage'
  /** Enter a new PIN. */
  | 'create'
  /** Enter it again. */
  | 'confirm';

export interface SetPinModel {
  stage: SetPinStage;
  entry: string;
  /** A translation key, resolved by the screen. */
  message: string | null;
  busy: boolean;
  /** Set once the PIN has been enrolled, changed or removed. */
  done: 'saved' | 'removed' | null;
  pressDigit: (digit: string) => void;
  pressBackspace: () => void;
  chooseChange: () => void;
  chooseRemove: () => void;
}

export interface UseSetPinOptions {
  /** Whether a PIN already exists. Decides the opening stage. */
  enrolled: boolean;
  storage?: LockStoragePort;
}

export function useSetPin({ enrolled, storage = lockStorage }: UseSetPinOptions): SetPinModel {
  const [stage, setStage] = useState<SetPinStage>(enrolled ? 'current' : 'create');
  const [entry, setEntry] = useState('');
  const [first, setFirst] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<'saved' | 'removed' | null>(null);

  const complete = useCallback(
    async (pin: string) => {
      setBusy(true);

      try {
        switch (stage) {
          case 'current': {
            const record = await storage.readPinRecord();

            if (record !== null && verifyPin(pin, record)) {
              setStage('manage');
              setMessage(null);
            } else {
              setMessage('lock.incorrectPin');
            }

            break;
          }

          case 'create': {
            const validation = validatePin(pin);

            if (!validation.ok) {
              setMessage(pinProblemKey(validation.problem));

              break;
            }

            setFirst(pin);
            setStage('confirm');
            setMessage(null);

            break;
          }

          case 'confirm': {
            if (pin !== first) {
              setStage('create');
              setFirst('');
              setMessage('lock.pinMismatch');

              break;
            }

            await storage.writePin(pin);
            setLockEnrolled(true);
            setDone('saved');

            break;
          }

          case 'manage':
            break;
        }
      } finally {
        setEntry('');
        setBusy(false);
      }
    },
    [first, stage, storage],
  );

  const pressDigit = useCallback(
    (digit: string) => {
      if (busy || stage === 'manage' || entry.length >= PIN_LENGTH) {
        return;
      }

      const next = entry + digit;

      setMessage(null);
      setEntry(next);

      if (next.length === PIN_LENGTH) {
        void complete(next);
      }
    },
    [busy, complete, entry, stage],
  );

  const pressBackspace = useCallback(() => {
    if (busy) {
      return;
    }

    setMessage(null);
    setEntry((current) => current.slice(0, -1));
  }, [busy]);

  const chooseChange = useCallback(() => {
    setStage('create');
    setEntry('');
    setFirst('');
    setMessage(null);
  }, []);

  const chooseRemove = useCallback(() => {
    setBusy(true);

    void storage
      .deletePin()
      .then(() => {
        // Unlocks as a side effect: with no PIN there is nothing left that
        // could re-open the gate.
        setLockEnrolled(false);
        setDone('removed');
      })
      .finally(() => {
        setBusy(false);
      });
  }, [storage]);

  return {
    stage,
    entry,
    message,
    busy,
    done,
    pressDigit,
    pressBackspace,
    chooseChange,
    chooseRemove,
  };
}
