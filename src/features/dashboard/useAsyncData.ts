import { useCallback, useEffect, useState } from 'react';

/**
 * Minimal async state for reading from the local database.
 *
 * Deliberately not a caching library: the data source is on-device SQLite, so
 * re-querying is cheap and a cache would add invalidation problems this app does
 * not have. What it does provide is the one thing that genuinely matters —
 * discarding stale results, so a slow earlier query cannot overwrite a newer one
 * when filters change quickly.
 */

export type AsyncState<T> =
  | { status: 'loading'; data: null; error: null }
  | { status: 'ready'; data: T; error: null }
  | { status: 'error'; data: null; error: Error };

export type AsyncResult<T> = AsyncState<T> & { reload: () => void };

type Load<T> = () => Promise<T>;

const LOADING = { status: 'loading', data: null, error: null } as const;

/**
 * @param load Must be wrapped in `useCallback` by the caller: its identity *is*
 * the request identity, so a new `load` means new inputs and a fresh query.
 */
export function useAsyncData<T>(load: Load<T>): AsyncResult<T> {
  const [attempt, setAttempt] = useState(0);

  /**
   * The result is stored alongside the request that produced it. Comparing them
   * during render lets `loading` be *derived* rather than assigned from inside
   * the effect — which avoids the cascading re-render the React Compiler
   * rejects, and makes displaying a stale result structurally impossible.
   */
  const [result, setResult] = useState<{
    load: Load<T>;
    attempt: number;
    state: AsyncState<T>;
  } | null>(null);

  const reload = useCallback(() => {
    setAttempt((previous) => previous + 1);
  }, []);

  useEffect(() => {
    let active = true;

    load()
      .then((data) => {
        if (active) {
          setResult({ load, attempt, state: { status: 'ready', data, error: null } });
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setResult({
            load,
            attempt,
            state: {
              status: 'error',
              data: null,
              error: error instanceof Error ? error : new Error(String(error)),
            },
          });
        }
      });

    return () => {
      active = false;
    };
  }, [load, attempt]);

  const isCurrent = result !== null && result.load === load && result.attempt === attempt;
  const state: AsyncState<T> = isCurrent ? result.state : LOADING;

  return { ...state, reload };
}
