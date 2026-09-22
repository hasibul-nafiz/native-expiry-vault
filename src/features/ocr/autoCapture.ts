import type { ScanResult } from './scanImage';

/**
 * The auto-capture policy, as a pure state machine.
 *
 * Auto mode exists because the export promises it, but the OCR library cannot
 * see camera frames — `TextRecognition.recognize()` takes an image path, and
 * there is no frame processor. So "auto" is: take a cheap still on a timer,
 * run it through the parser, and lock when the result is good enough.
 *
 * That is a loop that takes photographs and runs a model, which costs battery
 * and makes a phone warm. The attempt cap is not a nicety; it is the reason
 * the loop is acceptable at all. After it, the shutter is the only way
 * forward and the screen says so.
 *
 * The timer and the camera live in the screen. Every *decision* lives here, so
 * all of it is tested without either.
 */

/** Milliseconds between attempts. Below this the model has no time to finish. */
export const AUTO_CAPTURE_INTERVAL_MS = 1500;

/** Attempts before giving up: 18 seconds of pointing at a document. */
export const MAX_AUTO_ATTEMPTS = 12;

/**
 * The score a candidate must beat to lock automatically.
 *
 * Above a verified MRZ (0.98) and a labelled month-name date (0.7), below an
 * unlabelled numeric one. Locking on a bare `04/03/29` found on a receipt
 * would auto-confirm the reading this parser deliberately refuses to guess.
 */
export const AUTO_LOCK_SCORE = 0.7;

export type AutoCaptureState =
  | { phase: 'idle' }
  | { phase: 'scanning'; attempts: number; inFlight: boolean }
  | { phase: 'locked'; result: ScanResult }
  | { phase: 'exhausted' };

export type AutoCaptureEvent =
  /** The user switched to auto mode, or returned to the screen. */
  | { type: 'start' }
  /** The timer fired. */
  | { type: 'tick' }
  /** An attempt finished. */
  | { type: 'result'; result: ScanResult }
  /** An attempt failed — a blurred frame, a camera hiccup. Not fatal. */
  | { type: 'failed' }
  /** The screen blurred, the app backgrounded, or the user switched to manual. */
  | { type: 'stop' };

export const initialAutoCaptureState: AutoCaptureState = { phase: 'idle' };

/** True when the result is good enough to stop asking the user to hold still. */
export function shouldLock(result: ScanResult): boolean {
  return result.candidates.some((candidate) => candidate.score >= AUTO_LOCK_SCORE);
}

export function autoCaptureReducer(
  state: AutoCaptureState,
  event: AutoCaptureEvent,
): AutoCaptureState {
  if (event.type === 'stop') {
    return { phase: 'idle' };
  }

  if (event.type === 'start') {
    // Restarting a locked or exhausted run begins a fresh count, which is what
    // makes "try again" work without unmounting the camera.
    return { phase: 'scanning', attempts: 0, inFlight: false };
  }

  if (state.phase !== 'scanning') {
    // A result arriving after the user switched to manual, or a stray tick
    // once locked. Ignored rather than resurrecting a finished run.
    return state;
  }

  switch (event.type) {
    case 'tick': {
      if (state.inFlight) {
        // The previous attempt has not come back. Starting another would queue
        // recognitions faster than the device can run them.
        return state;
      }

      if (state.attempts >= MAX_AUTO_ATTEMPTS) {
        return { phase: 'exhausted' };
      }

      return { phase: 'scanning', attempts: state.attempts + 1, inFlight: true };
    }

    case 'result': {
      if (shouldLock(event.result)) {
        return { phase: 'locked', result: event.result };
      }

      return { phase: 'scanning', attempts: state.attempts, inFlight: false };
    }

    case 'failed':
      return { phase: 'scanning', attempts: state.attempts, inFlight: false };
  }
}

/** Whether the screen should take a picture right now. */
export function shouldCapture(state: AutoCaptureState): boolean {
  return state.phase === 'scanning' && state.inFlight;
}
