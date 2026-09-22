import { useSyncExternalStore } from 'react';

import type { IsoDate } from '@/db/models';

/**
 * Carries a confirmed scan from the scanner back to whoever asked for it.
 *
 * The scanner is a route, not a child component, because the export draws it
 * full-bleed with no chrome and because the camera must unmount when it is
 * dismissed. Routes cannot return a value: expo-router navigates, it does not
 * call back. Remounting the add-item form with the result as a parameter would
 * throw away everything already typed into it.
 *
 * So the result is left here and collected on the way back — the same
 * module-level `useSyncExternalStore` as `reminderStore`, for the same reason.
 * Deliberately a single slot: there is only ever one scan in flight, and a
 * queue would only let a stale one arrive later.
 */

type Listener = () => void;

export interface ScanHandoff {
  expiryDate: IsoDate;
  /** Only set when a machine-readable zone supplied them. */
  documentNumber?: string;
  /** ISO 3166-1 alpha-2. */
  country?: string;
  issueDate?: IsoDate;
  /**
   * Everything recognised, for `items.ocr_raw_text`. Holds the MRZ, so it
   * holds the document number: never logged, never rendered whole.
   */
  rawText: string;
  /** Our ranking of the chosen date, for `items.ocr_confidence`. */
  confidence: number;
  /** The captured image, so the form can offer to keep it as an attachment. */
  imageUri: string;
}

let pending: ScanHandoff | null = null;
const listeners = new Set<Listener>();

function emit(): void {
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): ScanHandoff | null {
  return pending;
}

export function publishScan(handoff: ScanHandoff): void {
  pending = handoff;
  emit();
}

/**
 * Takes the pending scan, leaving the slot empty.
 *
 * Read-and-clear rather than read-then-clear so a form that remounts — which
 * the wizard does whenever the user steps backwards — cannot apply the same
 * scan twice over fields they have since corrected.
 */
export function consumeScan(): ScanHandoff | null {
  const handoff = pending;

  if (handoff !== null) {
    pending = null;
    emit();
  }

  return handoff;
}

/** Test-only: the slot outlives a component, so each test needs a clean one. */
export function resetScanHandoff(): void {
  pending = null;
  emit();
}

/** Subscribes without consuming, so a screen can react to a scan arriving. */
export function usePendingScan(): ScanHandoff | null {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
