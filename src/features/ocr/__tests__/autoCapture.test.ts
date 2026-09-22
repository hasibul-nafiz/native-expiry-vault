import {
  AUTO_LOCK_SCORE,
  autoCaptureReducer,
  type AutoCaptureState,
  initialAutoCaptureState,
  MAX_AUTO_ATTEMPTS,
  shouldCapture,
} from '../autoCapture';
import type { ScanResult } from '../scanImage';

/**
 * The polling policy, with no timer and no camera anywhere near it.
 *
 * The cases that matter are the ones that would otherwise cost the user
 * battery: not queueing a second recognition behind the first, and stopping
 * altogether instead of looping until the phone is warm.
 */

function resultScoring(score: number): ScanResult {
  return {
    rawText: 'Expires 28 OCT 2030',
    candidates: [
      { date: '2030-10-28', score, source: '28 OCT 2030', format: 'month-name', ambiguous: false },
    ],
    mrz: null,
    confidence: score,
  };
}

const GOOD = resultScoring(AUTO_LOCK_SCORE);
const WEAK = resultScoring(AUTO_LOCK_SCORE - 0.1);

function scanning(attempts: number, inFlight: boolean): AutoCaptureState {
  return { phase: 'scanning', attempts, inFlight };
}

/** Drives the machine through `count` complete attempts that find nothing. */
function afterFailedAttempts(count: number): AutoCaptureState {
  let state = autoCaptureReducer(initialAutoCaptureState, { type: 'start' });

  for (let index = 0; index < count; index += 1) {
    state = autoCaptureReducer(state, { type: 'tick' });
    state = autoCaptureReducer(state, { type: 'result', result: WEAK });
  }

  return state;
}

describe('autoCaptureReducer', () => {
  it('starts idle and does nothing until told to', () => {
    expect(initialAutoCaptureState).toEqual({ phase: 'idle' });
    expect(shouldCapture(initialAutoCaptureState)).toBe(false);
  });

  it('begins scanning on start', () => {
    expect(autoCaptureReducer(initialAutoCaptureState, { type: 'start' })).toEqual(
      scanning(0, false),
    );
  });

  it('takes a picture on the first tick', () => {
    const state = autoCaptureReducer(scanning(0, false), { type: 'tick' });

    expect(state).toEqual(scanning(1, true));
    expect(shouldCapture(state)).toBe(true);
  });

  it('ignores a tick while an attempt is still running', () => {
    const state = scanning(1, true);

    // Otherwise the timer queues recognitions faster than they complete.
    expect(autoCaptureReducer(state, { type: 'tick' })).toBe(state);
  });

  it('locks on a result good enough to trust', () => {
    const state = autoCaptureReducer(scanning(1, true), { type: 'result', result: GOOD });

    expect(state).toEqual({ phase: 'locked', result: GOOD });
  });

  it('keeps scanning on a result that is not good enough', () => {
    expect(autoCaptureReducer(scanning(1, true), { type: 'result', result: WEAK })).toEqual(
      scanning(1, false),
    );
  });

  it('does not lock on a date it would refuse to guess', () => {
    const ambiguous: ScanResult = {
      rawText: 'Warranty until 04/03/2029',
      candidates: [
        {
          date: '2029-03-04',
          score: 0.35,
          source: '04/03/2029',
          format: 'dmy',
          ambiguous: true,
          alternative: '2029-04-03',
        },
      ],
      mrz: null,
      confidence: 0.35,
    };

    expect(
      autoCaptureReducer(scanning(1, true), { type: 'result', result: ambiguous }).phase,
    ).toBe('scanning');
  });

  it('retries after a failed attempt without spending the count twice', () => {
    expect(autoCaptureReducer(scanning(3, true), { type: 'failed' })).toEqual(scanning(3, false));
  });

  it('gives up after the attempt cap rather than looping forever', () => {
    const exhausted = afterFailedAttempts(MAX_AUTO_ATTEMPTS);

    expect(exhausted).toEqual(scanning(MAX_AUTO_ATTEMPTS, false));
    expect(autoCaptureReducer(exhausted, { type: 'tick' })).toEqual({ phase: 'exhausted' });
  });

  it('takes no more pictures once exhausted', () => {
    const state: AutoCaptureState = { phase: 'exhausted' };

    expect(autoCaptureReducer(state, { type: 'tick' })).toBe(state);
    expect(shouldCapture(state)).toBe(false);
  });

  it('stops on blur or backgrounding, from any phase', () => {
    for (const state of [
      scanning(4, true),
      { phase: 'locked', result: GOOD } as AutoCaptureState,
      { phase: 'exhausted' } as AutoCaptureState,
    ]) {
      expect(autoCaptureReducer(state, { type: 'stop' })).toEqual({ phase: 'idle' });
    }
  });

  it('ignores a result that arrives after the user switched to manual', () => {
    const idle: AutoCaptureState = { phase: 'idle' };

    expect(autoCaptureReducer(idle, { type: 'result', result: GOOD })).toBe(idle);
  });

  it('ignores a second result once locked', () => {
    const locked: AutoCaptureState = { phase: 'locked', result: GOOD };

    expect(autoCaptureReducer(locked, { type: 'result', result: WEAK })).toBe(locked);
  });

  it('restarts a fresh count after giving up, so trying again works', () => {
    expect(autoCaptureReducer({ phase: 'exhausted' }, { type: 'start' })).toEqual(
      scanning(0, false),
    );
  });
});
