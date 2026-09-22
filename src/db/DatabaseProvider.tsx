import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import { getDatabase } from './index';
import type { Database } from './types';

/**
 * Opens the encrypted database once for the whole app and exposes the outcome.
 *
 * Opening is asynchronous and can genuinely fail — SQLCipher needs a key from
 * the keychain, and a corrupted entry is refused rather than silently replaced
 * (see `src/db/key.ts`). Surfacing that as state rather than a throw lets the UI
 * offer a retry instead of crashing on launch.
 *
 * Injecting the database through context, rather than having each screen call
 * `getDatabase()`, is also what lets tests supply F2's in-memory better-sqlite3
 * database and exercise real SQL against real migrations.
 */

export type DatabaseState =
  | { status: 'opening' }
  | { status: 'ready'; db: Database }
  | { status: 'error'; error: Error; retry: () => void };

const DatabaseContext = createContext<DatabaseState | null>(null);

const OPENING = { status: 'opening' } as const;

export interface DatabaseProviderProps {
  children: ReactNode;
  /** Supplied by tests; production opens the real encrypted database. */
  database?: Database;
}

export function DatabaseProvider({ children, database }: DatabaseProviderProps) {
  const [opened, setOpened] = useState<DatabaseState | null>(null);
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => {
    setOpened(null);
    setAttempt((previous) => previous + 1);
  }, []);

  useEffect(() => {
    if (database !== undefined) {
      return;
    }

    let active = true;

    getDatabase()
      .then((db) => {
        if (active) {
          setOpened({ status: 'ready', db });
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setOpened({
            status: 'error',
            error: error instanceof Error ? error : new Error(String(error)),
            retry,
          });
        }
      });

    return () => {
      active = false;
    };
  }, [database, attempt, retry]);

  // Derived rather than assigned in the effect: an injected database is ready
  // immediately, and the pending state needs no state write at all.
  const state: DatabaseState =
    database !== undefined ? { status: 'ready', db: database } : (opened ?? OPENING);

  return <DatabaseContext.Provider value={state}>{children}</DatabaseContext.Provider>;
}

export function useDatabaseState(): DatabaseState {
  const state = useContext(DatabaseContext);

  if (state === null) {
    throw new Error('useDatabaseState must be used inside a DatabaseProvider.');
  }

  return state;
}
